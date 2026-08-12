import { ArrowUp, Sparkles, X } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
  type Transition,
} from "motion/react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireDesktopBridge } from "@/claude/desktop-bridge";
import { useClaudeProgress } from "@/claude/use-claude-progress";
import { homeworkQuestionSchema, type HomeworkQuestion } from "@/shared/claude";

/**
 * The island is one element in five states. It is never unmounted between them,
 * because the whole effect depends on the same box travelling to its next shape.
 */
type IslandState = "idle" | "composing" | "loading" | "result" | "applying";

/**
 * A spring, not a duration. The box has apparent mass, so it settles instead of
 * stopping dead, and an interrupted animation continues from its current
 * velocity rather than restarting.
 * https://animations.dev/learn/animation-theory/what-makes-an-animation-feel-right
 */
const ISLAND_SPRING: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.9,
};

/**
 * Content changes faster than the box moves and blurs slightly on its way in and
 * out, so the eye follows the shape rather than trying to read text mid-morph.
 */
const CONTENT_TRANSITION: Transition = { duration: 0.19, ease: [0.32, 0.72, 0, 1] };
const CONTENT_ENTER = { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" };
const CONTENT_EXIT = { opacity: 0, scale: 0.96, y: -4, filter: "blur(3px)" };
const CONTENT_INITIAL = { opacity: 0, scale: 0.96, y: 6, filter: "blur(3px)" };

/**
 * Wide enough for a sentence, and `max-w-full` so the container it floats in is
 * what actually bounds it. Both are static classes: a width that switches
 * between `auto` and a percentage mid-morph is what made the box stutter.
 */
const ISLAND_EXPANDED_WIDTH = "w-[34rem] max-w-full";

const COLLAPSED_RADIUS = 999;
const EXPANDED_RADIUS = 24;

/**
 * The size of whatever the island is currently showing. Measured with a
 * ResizeObserver so a growing error line or a longer suggestion is a new target
 * for the same spring, not a second animation fighting the first.
 */
function useContentSize() {
  const slotRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number | "auto"; height: number | "auto" }>({
    width: "auto",
    height: "auto",
  });
  /**
   * How much room the island has, measured on the slot rather than on the island
   * itself. Clamping the content against the animated box would be circular: the
   * box is sized from the content it is clamping.
   */
  const [availableWidth, setAvailableWidth] = useState<number | undefined>(undefined);

  const contentKeyRef = useRef("idle");

  const measureNow = useCallback(function measureContent(contentKey?: string) {
    if (contentKey) contentKeyRef.current = contentKey;
    const content = contentRef.current;
    const slot = slotRef.current;
    if (!content || !slot) return;
    /**
     * The arriving state is measured by name, not by asking the wrapper how tall
     * it is. Presence takes the leaving state out of flow one commit later than
     * this runs, so the wrapper would still report both — and the box would spend
     * a beat at the old size before jumping.
     */
    const target =
      content.querySelector<HTMLElement>(
        `[data-island-content="${contentKeyRef.current}"]`,
      ) ?? content;

    /**
     * The clamp is applied to the DOM before measuring, not left for the next
     * render: measuring unclamped content first returns the height it would have
     * at full width, and the box would animate to that and then shrink again.
     */
    const slotWidth = Math.floor(slot.getBoundingClientRect().width);
    content.style.maxWidth = `${slotWidth}px`;
    setAvailableWidth(slotWidth);
    const rect = target.getBoundingClientRect();
    setSize({ width: Math.ceil(rect.width), height: Math.ceil(rect.height) });
  }, []);

  useEffect(function trackContentSize() {
    const content = contentRef.current;
    const slot = slotRef.current;
    if (!content || !slot) return;
    // Catches later changes — a wrapped error line, a longer suggestion — that no
    // state change announces.
    const observer = new ResizeObserver(() => measureNow());
    observer.observe(content);
    observer.observe(slot);
    return () => observer.disconnect();
  }, [measureNow]);

  return { slotRef, contentRef, size, availableWidth, measureNow };
}

export function ClaudeQuestionIsland({
  homeworkDraftId,
  homeworkTitle,
  homeworkSummary,
  question,
  questionId,
  neighboringPrompts,
  onApply,
}: {
  homeworkDraftId: Id<"homeworkDrafts">;
  homeworkTitle: string;
  homeworkSummary: string;
  question: HomeworkQuestion;
  questionId: Id<"homeworkQuestions">;
  neighboringPrompts: string[];
  onApply: (questionId: Id<"homeworkQuestions">, question: HomeworkQuestion) => Promise<void>;
}) {
  const rewrites = useQuery(api.aiJobs.listRewrites, { homeworkDraftId });
  const createRewriteJob = useMutation(api.aiJobs.createQuestionRewrite);
  const markRewriteRunning = useMutation(api.aiJobs.markRunning);
  const recordRewriteProgress = useMutation(api.aiJobs.recordProgress);
  const completeRewrite = useMutation(api.aiJobs.completeQuestionRewrite);
  const failRewrite = useMutation(api.aiJobs.finishWithError);
  const dismissRewrite = useMutation(api.aiJobs.dismissJob);
  const [state, setState] = useState<IslandState>("idle");
  const [instruction, setInstruction] = useState("");
  const [suggestion, setSuggestion] = useState<HomeworkQuestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const requestIdRef = useRef<string | null>(null);
  const islandId = useId();
  const prefersReducedMotion = useReducedMotion();
  const { slotRef, contentRef, size, availableWidth, measureNow } = useContentSize();
  const [liveRequestId, setLiveRequestId] = useState<string | null>(null);
  /** What Claude is doing right now, so a wait reads as work rather than a hang. */
  const step = useClaudeProgress(liveRequestId);

  /**
   * Measured before the browser paints the new state. A ResizeObserver only
   * reports a change after that paint, which left the box sitting at the previous
   * size for a few frames and then jumping — the stutter this replaces.
   */
  /**
   * The edit lives in `aiJobs`, so leaving the page or re-rendering does not lose
   * it: an in-flight request keeps running in the desktop process and writes its
   * result to the job, and this island reads it back wherever it is mounted.
   */
  const job = rewrites?.find((candidate) => candidate.questionId === questionId) ?? null;
  const persistedSuggestion = parseSuggestion(job?.resultSnapshot ?? null);
  const isJobRunning = job?.status === "pending" || job?.status === "running";
  const effectiveState: IslandState =
    state !== "idle"
      ? state
      : isJobRunning
        ? "loading"
        : persistedSuggestion
          ? "result"
          : "idle";
  const effectiveSuggestion = suggestion ?? persistedSuggestion;
  const effectiveError = error ?? (job?.status === "failed" ? job.errorMessage : null);
  const isCollapsed =
    effectiveState === "idle" || effectiveState === "loading" || effectiveState === "applying";
  const activeJobId = job?._id ?? null;

  useEffect(function mirrorProgressOntoJob() {
    if (!activeJobId || !step) return;
    // Mirrored so a screen that did not start the edit can still show its step.
    void recordRewriteProgress({
      aiJobId: activeJobId,
      activity: { kind: "runtime", label: step, at: Date.now() },
      activityCount: 1,
    }).catch(() => undefined);
  }, [activeJobId, recordRewriteProgress, step]);
  /**
   * Measured before the browser paints the new state. A ResizeObserver only
   * reports a change after that paint, which left the box sitting at the previous
   * size for a few frames and then jumping — the stutter this replaces.
   */
  useLayoutEffect(function measureArrivingState() {
    measureNow(
      effectiveState === "loading" || effectiveState === "applying" ? "busy" : effectiveState,
    );
  }, [measureNow, effectiveState, effectiveSuggestion, effectiveError, step]);

  useEffect(function focusInputWhenComposing() {
    if (state !== "composing") return;
    // The morph and the caret should not fight: focus once the box has room.
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [state]);

  async function requestRevision() {
    const teacherInstruction = instruction.trim();
    if (!teacherInstruction) return;

    const requestId = crypto.randomUUID();
    requestIdRef.current = requestId;
    setLiveRequestId(requestId);
    setError(null);
    setSuggestion(null);
    // Collapse first: the teacher gets the preview back while Claude works.
    setState("loading");

    // Recorded before the request starts, so the work is visible — and
    // recoverable — even if this component is gone before Claude answers.
    const aiJobId = await createRewriteJob({
      requestId,
      homeworkDraftId,
      questionId,
      title: teacherInstruction,
      inputSnapshot: JSON.stringify({ questionId, prompt: question.prompt }),
    });
    await markRewriteRunning({ aiJobId }).catch(() => undefined);

    try {
      const result = await requireDesktopBridge().rewriteHomeworkQuestion({
        requestId,
        homeworkTitle,
        homeworkSummary,
        teacherInstruction,
        question,
        neighboringPrompts,
      });
      // Written to the job first: this resolves even when the island has
      // unmounted, and the suggestion must not be lost with the component.
      await completeRewrite({ aiJobId, resultSnapshot: JSON.stringify(result.question) });
      // A superseded request must not reopen the island over a newer one.
      if (requestIdRef.current !== requestId) return;
      setLiveRequestId(null);
      setSuggestion(result.question);
      setState("result");
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Claude could not revise this activity.";
      await failRewrite({ aiJobId, status: "failed", errorMessage: message }).catch(
        () => undefined,
      );
      if (requestIdRef.current !== requestId) return;
      setLiveRequestId(null);
      setError(message);
      setState("composing");
    }
  }

  async function applySuggestion() {
    const pending = suggestion ?? persistedSuggestion;
    if (!pending) return;
    setError(null);
    setState("applying");
    try {
      await onApply(questionId, pending);
      if (job) await dismissRewrite({ aiJobId: job._id }).catch(() => undefined);
      setSuggestion(null);
      setInstruction("");
      setState("idle");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The revision could not be applied.");
      setState("result");
    }
  }

  function cancelRevision() {
    const requestId = requestIdRef.current;
    requestIdRef.current = null;
    if (requestId) void requireDesktopBridge().cancelClaudeRequest(requestId).catch(() => undefined);
    setLiveRequestId(null);
    setState("composing");
  }

  return (
    <div ref={slotRef} className="flex w-full justify-center">
      <motion.div
        id={islandId}
        aria-live="polite"
        transition={prefersReducedMotion ? { duration: 0 } : ISLAND_SPRING}
        /**
         * The box is animated to a measured size rather than left to infer one.
         * Motion's automatic layout has to observe a change after it has already
         * happened, which is what made a content change flash at the wrong size
         * before settling; measuring the content first means one spring, straight
         * to the target. Radius is animated here too and never also set through
         * `style` — two sources for one property fight every frame.
         */
        animate={{
          width: size.width,
          height: size.height,
          borderRadius: isCollapsed ? COLLAPSED_RADIUS : EXPANDED_RADIUS,
        }}
        initial={false}
        className={cn(
          "relative max-w-full overflow-hidden border border-border/80 bg-card",
          "shadow-[0_10px_34px_-14px_oklch(0_0_0/.22),0_2px_8px_-4px_oklch(0_0_0/.12)]",
        )}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          if (effectiveState === "composing") setState(effectiveSuggestion ? "result" : "idle");
          if (effectiveState === "result") setState("idle");
        }}
      >
        {/* Contents are stacked, not laid out: each state occupies the same
            origin so one can cross-fade over another without moving it. */}
        <div
          ref={contentRef}
          className="absolute left-0 top-0 w-max"
          /* `relative` children measure against this box. */
          style={{ maxWidth: availableWidth }}
        >
        <AnimatePresence initial={false}>
          {effectiveState === "idle" ? (
            <IslandContent key="idle" contentKey="idle" prefersReducedMotion={prefersReducedMotion}>
              <button
                type="button"
                aria-expanded={false}
                aria-controls={islandId}
                onClick={() => setState("composing")}
                className="flex h-10 items-center gap-2 px-4 text-[13px] font-medium text-foreground outline-none transition-colors duration-150 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <Sparkles size={13} aria-hidden />
                Ask Claude
              </button>
            </IslandContent>
          ) : null}

          {effectiveState === "loading" || effectiveState === "applying" ? (
            <IslandContent key="busy" contentKey="busy" prefersReducedMotion={prefersReducedMotion}>
              {/* Same pill as idle, now carrying the work — the collapsed state
                  is the loading state, exactly as a Dynamic Island behaves. */}
              <button
                type="button"
                disabled={effectiveState === "applying"}
                aria-controls={islandId}
                onClick={cancelRevision}
                className="flex h-10 items-center gap-2.5 px-4 text-[13px] font-medium text-foreground outline-none transition-colors duration-150 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-default"
              >
                <IslandPulse />
                <span className="max-w-[16rem] truncate">
                  {effectiveState === "applying"
                    ? "Saving"
                    : (step ?? job?.latestActivity?.label ?? "Rewriting")}
                </span>
                {effectiveState === "loading" ? (
                  <span className="shrink-0 text-[12px] text-muted-foreground">· tap to edit</span>
                ) : null}
              </button>
            </IslandContent>
          ) : null}

          {effectiveState === "composing" ? (
            <IslandContent key="composing" contentKey="composing" prefersReducedMotion={prefersReducedMotion}>
              <div className={ISLAND_EXPANDED_WIDTH}>
                {effectiveError ? <IslandError message={effectiveError} /> : null}
                <div className="flex items-end gap-2 px-3 py-2.5 sm:pl-4">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    aria-label="Ask Claude to revise this activity"
                    value={instruction}
                    placeholder="Ask Claude to change this activity…"
                    onChange={(event) => setInstruction(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" || event.shiftKey) return;
                      event.preventDefault();
                      void requestRevision();
                    }}
                    className="max-h-24 min-h-9 flex-1 resize-none bg-transparent py-2 text-[14px] leading-6 text-foreground outline-none placeholder:text-muted-foreground"
                  />
                  <IslandIconButton
                    label="Close Claude"
                    onClick={() => setState(suggestion ? "result" : "idle")}
                  >
                    <X size={15} aria-hidden />
                  </IslandIconButton>
                  <IslandIconButton
                    label="Send to Claude"
                    isPrimary
                    isDisabled={instruction.trim().length === 0}
                    onClick={() => void requestRevision()}
                  >
                    <ArrowUp size={16} strokeWidth={2.2} aria-hidden />
                  </IslandIconButton>
                </div>
              </div>
            </IslandContent>
          ) : null}

          {effectiveState === "result" && effectiveSuggestion ? (
            <IslandContent key="result" contentKey="result" prefersReducedMotion={prefersReducedMotion}>
              <div className={ISLAND_EXPANDED_WIDTH}>
                {effectiveError ? <IslandError message={effectiveError} /> : null}
                <div className="px-4 py-3.5 sm:px-5">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                    Claude suggests
                  </p>
                  <p className="mt-1.5 whitespace-pre-line text-pretty text-[14px] font-medium leading-6">
                    {effectiveSuggestion.prompt}
                  </p>
                  {effectiveSuggestion.instructions ? (
                    <p className="mt-1.5 text-pretty text-[12.5px] leading-5 text-muted-foreground">
                      {effectiveSuggestion.instructions}
                    </p>
                  ) : null}
                  <div className="mt-3 flex items-center justify-end gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => setState("composing")}>
                      Adjust
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (job) void dismissRewrite({ aiJobId: job._id });
                        setSuggestion(null);
                        setState("idle");
                      }}
                    >
                      Discard
                    </Button>
                    <Button size="sm" onClick={() => void applySuggestion()}>
                      Apply
                    </Button>
                  </div>
                </div>
              </div>
            </IslandContent>
          ) : null}
        </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * One state's contents. `popLayout` takes the outgoing child out of flow, so the
 * box measures only what is arriving and never jumps to fit both at once.
 */
function IslandContent({
  contentKey,
  children,
  prefersReducedMotion,
}: {
  contentKey: string;
  children: React.ReactNode;
  prefersReducedMotion: boolean | null;
}) {
  /**
   * Only the current state occupies flow. A leaving state is lifted out of it, so
   * the box is never as tall as two states stacked — which is what made it balloon
   * and settle back with the border stretched through both.
   */
  const isPresent = useIsPresent();

  return (
    <motion.div
      data-island-content={contentKey}
      initial={prefersReducedMotion ? { opacity: 0 } : CONTENT_INITIAL}
      animate={CONTENT_ENTER}
      exit={prefersReducedMotion ? { opacity: 0 } : CONTENT_EXIT}
      transition={prefersReducedMotion ? { duration: 0.12 } : CONTENT_TRANSITION}
      className={cn(
        "flex min-w-0",
        isPresent ? "relative" : "pointer-events-none absolute inset-0",
      )}
    >
      {children}
    </motion.div>
  );
}

/** The live indicator: a breathing dot, the way iOS marks ongoing activity. */
function IslandPulse() {
  return (
    <motion.span
      aria-hidden
      className="size-2 shrink-0 rounded-full bg-primary"
      animate={{ opacity: [1, 0.35, 1], scale: [1, 0.82, 1] }}
      transition={{ duration: 1.15, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function IslandIconButton({
  label,
  isPrimary,
  isDisabled,
  onClick,
  children,
}: {
  label: string;
  isPrimary?: boolean;
  isDisabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      disabled={isDisabled}
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      transition={ISLAND_SPRING}
      className={cn(
        "mb-0.5 grid shrink-0 place-items-center rounded-full outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-45",
        isPrimary
          ? "size-9 bg-foreground text-background hover:bg-foreground/85"
          : "size-8 text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </motion.button>
  );
}

function IslandError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="border-b border-destructive/15 bg-critical-soft px-4 py-2.5 text-[12px] leading-5 text-destructive sm:px-5"
    >
      {message}
    </p>
  );
}

function parseSuggestion(snapshot: string | null) {
  if (!snapshot) return null;
  try {
    return homeworkQuestionSchema.parse(JSON.parse(snapshot));
  } catch {
    // A snapshot written by an older build is simply ignored.
    return null;
  }
}
