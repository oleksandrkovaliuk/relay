import { useConvex, useMutation } from "convex/react";
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { GenerateHomeworkInput, HomeworkDraft } from "@/shared/claude";
import { describeClaudeRuntimeEvent } from "./claude-activity";
import { readClaudeModel } from "./claude-model-preference";
import { getDesktopBridge } from "./desktop-bridge";

type StartGenerationInput = Omit<GenerateHomeworkInput, "requestId" | "model">;

type GenerationRuns = {
  /**
   * Starts a generation and returns once it is recorded, not once it finishes:
   * the caller is free to navigate away immediately.
   */
  start: (input: StartGenerationInput, meta: { title: string; studentId?: Id<"students"> }) => Promise<void>;
};

const GenerationRunsContext = createContext<GenerationRuns | null>(null);

/**
 * Homework generations, owned above the pages instead of inside the builder.
 * A run takes minutes and the teacher should not have to sit on one screen for
 * it: the request lives in the desktop process, and this keeps writing its
 * progress to the job wherever they navigate. Mounted once, for the life of the
 * window.
 */
export function GenerationRunsProvider({ children }: { children: ReactNode }) {
  const createJob = useMutation(api.aiJobs.createHomeworkGeneration);
  const markRunning = useMutation(api.aiJobs.markRunning);
  const completeJob = useMutation(api.aiJobs.completeHomeworkGeneration);
  const finishJob = useMutation(api.aiJobs.finishWithError);
  const recordProgress = useMutation(api.aiJobs.recordProgress);
  const convex = useConvex();
  /** requestId → the job its runtime events belong to. */
  const runsRef = useRef(new Map<string, { aiJobId: Id<"aiJobs">; activityCount: number }>());

  useEffect(function mirrorRuntimeProgressOntoJobs() {
    const bridge = getDesktopBridge();
    if (!bridge) return;
    return bridge.onClaudeRuntimeEvent((event) => {
      const run = runsRef.current.get(event.requestId);
      if (!run) return;
      /**
       * Structured output arrives as one tool call at the end, so a generation
       * emits almost no events. Every one that does arrive is worth showing.
       */
      const update = describeClaudeRuntimeEvent(event);
      run.activityCount += 1;
      void recordProgress({
        aiJobId: run.aiJobId,
        activity: {
          kind: update.kind,
          label: update.label,
          ...(update.detail ? { detail: update.detail } : {}),
          at: Date.now(),
        },
        activityCount: run.activityCount,
      }).catch(() => undefined);
    });
  }, [recordProgress]);

  useEffect(function failRunsWhenTheWindowCloses() {
    function abandonRuns() {
      // Best effort: the desktop process dies with the window, so a job left
      // "running" would sit in the library forever claiming to be alive.
      for (const [requestId, run] of runsRef.current) {
        void getDesktopBridge()?.cancelClaudeRequest(requestId).catch(() => undefined);
        void finishJob({
          aiJobId: run.aiJobId,
          status: "cancelled",
          errorMessage: "Relay was closed while this generation was running.",
        }).catch(() => undefined);
      }
    }
    window.addEventListener("beforeunload", abandonRuns);
    return () => window.removeEventListener("beforeunload", abandonRuns);
  }, [finishJob]);

  const start = useCallback(
    async function start(
      input: StartGenerationInput,
      meta: { title: string; studentId?: Id<"students"> },
    ) {
      const bridge = getDesktopBridge();
      if (!bridge) throw new Error("Homework generation runs in the desktop app.");

      const requestId = crypto.randomUUID();
      /**
       * Read at send time rather than subscribed to: the profile only matters at
       * the moment a run starts, and a live subscription would re-render every
       * page in the app whenever the teacher edits an activity.
       */
      const teachingStyle = await convex.query(api.teaching.styleProfile, {}).catch(() => null);
      const request: GenerateHomeworkInput = {
        ...input,
        requestId,
        model: readClaudeModel(),
        ...(teachingStyle ? { teachingStyle } : {}),
      };
      // Recorded before the request starts, so the work is visible from the
      // moment the teacher leaves the builder.
      const aiJobId = await createJob({
        requestId,
        title: meta.title,
        ...(meta.studentId ? { studentId: meta.studentId } : {}),
        inputSnapshot: JSON.stringify(request),
      });
      runsRef.current.set(requestId, { aiJobId, activityCount: 1 });
      await markRunning({ aiJobId }).catch(() => undefined);
      await recordProgress({
        aiJobId,
        activity: { kind: "request", label: "Writing the set", at: Date.now() },
        activityCount: 1,
      }).catch(() => undefined);

      // Deliberately not awaited: the caller navigates away while this runs.
      void (async function runToCompletion() {
        try {
          const result = await bridge.generateHomework(request);
          await completeJob({ aiJobId, draft: toConvexDraft(result.draft) });
          void bridge
            .notify({
              title: "Homework draft ready",
              body: `${result.draft.title} · ${result.draft.questions.length} activities to review.`,
            })
            .catch(() => undefined);
        } catch (caught) {
          await finishJob({
            aiJobId,
            status: "failed",
            errorMessage: caught instanceof Error ? caught.message : "Generation failed.",
          }).catch(() => undefined);
        } finally {
          runsRef.current.delete(requestId);
        }
      })();
    },
    [completeJob, convex, createJob, finishJob, markRunning, recordProgress],
  );

  return (
    <GenerationRunsContext.Provider value={{ start }}>{children}</GenerationRunsContext.Provider>
  );
}

export function useGenerationRuns() {
  const runs = useContext(GenerationRunsContext);
  if (!runs) throw new Error("useGenerationRuns must be used inside GenerationRunsProvider.");
  return runs;
}

/** The generated set as the backend stores it, including the optional parts. */
function toConvexDraft(draft: HomeworkDraft) {
  return {
    title: draft.title,
    summary: draft.summary,
    estimatedMinutes: draft.estimatedMinutes,
    learningObjectives: draft.learningObjectives,
    ...(draft.referenceRules?.length ? { referenceRules: draft.referenceRules } : {}),
    questions: draft.questions.map((question) => ({
      id: question.id,
      type: question.type,
      prompt: question.prompt,
      instructions: question.instructions,
      content: question.content,
      skillTags: question.skillTags,
      points: question.points,
      difficulty: question.difficulty,
      explanation: question.explanation,
      ...(question.set ? { set: question.set } : {}),
    })),
  };
}
