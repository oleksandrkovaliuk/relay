import { ArrowUp, Check, Pencil, Sparkles, Square, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useConvex, useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { toPublicContent } from "@convex/content";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { requireDesktopBridge } from "@/claude/desktop-bridge";
import { DEFAULT_CLAUDE_MODEL } from "@/shared/claude";
import { useClaudeProgress } from "@/claude/use-claude-progress";
import { homeworkContextSchema, homeworkQuestionSchema, type HomeworkQuestion } from "@/shared/claude";
import { QuestionWidget } from "@/homework/player/question-widgets";
import { emptyResponse } from "@/homework/player/answer-types";

type EditorState = "idle" | "loading" | "saving";

export function QuestionEditor({
  homeworkDraftId, homeworkTitle, homeworkSummary, question, questionId, neighboringPrompts, onApply,
}: {
  homeworkDraftId: Id<"homeworkDrafts">;
  homeworkTitle: string;
  homeworkSummary: string;
  question: HomeworkQuestion;
  questionId: Id<"homeworkQuestions">;
  neighboringPrompts: string[];
  onApply: (questionId: Id<"homeworkQuestions">, question: HomeworkQuestion) => Promise<void>;
}) {
  const convex = useConvex();
  const rewrites = useQuery(api.aiJobs.listRewrites, { homeworkDraftId });
  const createJob = useMutation(api.aiJobs.createQuestionRewrite);
  const markRunning = useMutation(api.aiJobs.markRunning);
  const completeJob = useMutation(api.aiJobs.completeQuestionRewrite);
  const finishJob = useMutation(api.aiJobs.finishWithError);
  const dismissJob = useMutation(api.aiJobs.dismissJob);
  const [state, setState] = useState<EditorState>("idle");
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [liveRequestId, setLiveRequestId] = useState<string | null>(null);
  const requestRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const jobIdRef = useRef<Id<"aiJobs"> | null>(null);
  const step = useClaudeProgress(liveRequestId);
  const job = rewrites?.find((candidate) => candidate.questionId === questionId);
  const suggestion = useMemo(() => parseSuggestion(job?.resultSnapshot), [job?.resultSnapshot]);
  const isRunning = state === "loading" || job?.status === "pending" || job?.status === "running";
  const isBusy = isRunning || state === "saving";

  async function requestRevision() {
    const teacherInstruction = instruction.trim();
    if (!teacherInstruction || busyRef.current || isBusy) return;
    busyRef.current = true;
    const requestId = crypto.randomUUID();
    requestRef.current = requestId;
    setLiveRequestId(requestId);
    setState("loading");
    setError(null);
    setNotice(null);
    let aiJobId: Id<"aiJobs"> | null = null;
    try {
      const [teachingStyle, snapshot] = await Promise.all([
        convex.query(api.teaching.styleProfile, {}),
        convex.query(api.aiJobs.generationContext, { homeworkDraftId }),
      ]);
      if (requestRef.current !== requestId) return;
      const context = snapshot ? homeworkContextSchema.parse(JSON.parse(snapshot)) : undefined;
      const request = { requestId, model: DEFAULT_CLAUDE_MODEL, homeworkTitle, homeworkSummary, teacherInstruction, question, neighboringPrompts, teachingStyle, context };
      aiJobId = await createJob({ requestId, homeworkDraftId, questionId, title: teacherInstruction, inputSnapshot: JSON.stringify(request) });
      jobIdRef.current = aiJobId;
      if (requestRef.current !== requestId) {
        await finishJob({ aiJobId, status: "cancelled", errorMessage: "Revision stopped." });
        return;
      }
      await markRunning({ aiJobId });
      const result = await requireDesktopBridge().rewriteHomeworkQuestion(request);
      if (requestRef.current !== requestId) return;
      await completeJob({ aiJobId, resultSnapshot: JSON.stringify(result.question) });
      setNotice("Revision ready. Try it below, then apply or discard it.");
    } catch (caught) {
      if (requestRef.current !== requestId) return;
      const message = caught instanceof Error ? caught.message : "Could not revise this activity.";
      setError(message);
      if (aiJobId) await finishJob({ aiJobId, status: "failed", errorMessage: message }).catch(() => undefined);
    } finally {
      if (requestRef.current === requestId) {
        setState("idle");
        setLiveRequestId(null);
        busyRef.current = false;
      }
    }
  }

  async function cancelRevision() {
    const requestId = requestRef.current ?? job?.requestId;
    requestRef.current = null;
    const aiJobId = jobIdRef.current ?? job?._id;
    setState("idle");
    setLiveRequestId(null);
    busyRef.current = false;
    setError(null);
    try {
      if (requestId) await requireDesktopBridge().cancelClaudeRequest(requestId);
      if (aiJobId) await finishJob({ aiJobId, status: "cancelled", errorMessage: "Revision stopped." });
      setNotice("Stopped. Your activity is unchanged.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not stop the revision.");
    }
  }

  async function saveRevision(revision: HomeworkQuestion) {
    if (busyRef.current || isBusy) return;
    busyRef.current = true;
    setState("saving");
    setError(null);
    try {
      await onApply(questionId, homeworkQuestionSchema.parse(revision));
      if (job) await dismissJob({ aiJobId: job._id, outcome: revision === suggestion ? "applied" : "discarded" });
      setInstruction("");
      setNotice("Changes saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save. Your revision is still available.");
    } finally {
      busyRef.current = false;
      setState("idle");
    }
  }

  return (
    <section aria-label="Edit activity" className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-[13px] font-medium">
        <Sparkles size={15} className="text-primary" aria-hidden /> Revise with Claude
        <span className="ml-auto text-[11px] font-normal text-muted-foreground">Opus 5</span>
      </div>
      <Textarea
        aria-label="Ask Claude to revise this activity"
        rows={2}
        maxLength={10_000}
        value={instruction}
        onChange={(event) => setInstruction(event.target.value)}
        placeholder="What would make this activity better?"
        disabled={isBusy}
        className="min-h-20 resize-y rounded-xl border-0 bg-muted/50 p-3 shadow-none focus-visible:ring-2"
        onKeyDown={(event) => {
          if (event.key !== "Enter" || (!event.metaKey && !event.ctrlKey) || event.nativeEvent.isComposing) return;
          event.preventDefault();
          void requestRevision();
        }}
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[11.5px] leading-4 text-muted-foreground">Lesson brief, learner context and teaching style included.</p>
        {isRunning ? (
          <Button size="sm" variant="outline" onClick={() => void cancelRevision()}><Square size={12} /> Stop</Button>
        ) : (
          <Button size="icon" aria-label="Generate revision" disabled={isBusy || !instruction.trim()} onClick={() => void requestRevision()}><ArrowUp size={16} /></Button>
        )}
      </div>
      <div aria-live="polite" className="text-[12px] leading-5">
        {isBusy ? <p className="mt-3 flex items-center gap-2"><Spinner className="size-3.5" />{state === "saving" ? "Saving changes…" : step ?? job?.latestActivity?.label ?? "Preparing revision…"}</p> : null}
        {notice ? <p className="mt-3 text-muted-foreground">{notice}</p> : null}
      </div>
      {error || job?.status === "failed" ? <p role="alert" className="mt-3 text-[12px] text-destructive">{error ?? job?.errorMessage}</p> : null}
      {suggestion && !isRunning ? (
        <div className="mt-4 border-t border-border pt-4">
          <RevisionPreview question={suggestion} />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" disabled={isBusy} onClick={() => {
              if (!job) return;
              void dismissJob({ aiJobId: job._id }).then(() => setNotice("Revision discarded.")).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not discard."));
            }}><X size={14} /> Discard</Button>
            <Button size="sm" disabled={isBusy} onClick={() => void saveRevision(suggestion)}><Check size={14} /> Apply revision</Button>
          </div>
        </div>
      ) : null}
      <ManualQuestionEdit question={question} isBusy={isBusy} onSave={saveRevision} />
    </section>
  );
}

function RevisionPreview({ question }: { question: HomeworkQuestion }) {
  const content = useMemo(() => toPublicContent(question.content), [question.content]);
  const [response, setResponse] = useState(() => emptyResponse(content));
  useEffect(() => setResponse(emptyResponse(content)), [content]);
  return <div className="grid gap-3">
    <p className="text-[11px] font-medium uppercase tracking-wide text-primary">Proposed activity</p>
    <p className="text-sm font-medium">{question.prompt}</p>
    <p className="text-xs text-muted-foreground">{question.instructions}</p>
    <QuestionWidget content={content} response={response} onChange={setResponse} />
    <p className="rounded-xl bg-muted/50 p-3 text-xs leading-5"><span className="font-medium">Explanation: </span>{question.explanation}</p>
  </div>;
}

function ManualQuestionEdit({ question, isBusy, onSave }: {
  question: HomeworkQuestion;
  isBusy: boolean;
  onSave: (question: HomeworkQuestion) => Promise<void>;
}) {
  const [prompt, setPrompt] = useState(question.prompt);
  const [instructions, setInstructions] = useState(question.instructions);
  const [explanation, setExplanation] = useState(question.explanation);
  useEffect(() => {
    setPrompt(question.prompt);
    setInstructions(question.instructions);
    setExplanation(question.explanation);
  }, [question.prompt, question.instructions, question.explanation]);
  const hasChanges = prompt !== question.prompt || instructions !== question.instructions || explanation !== question.explanation;
  return <details className="mt-4 border-t border-border pt-3">
    <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground"><Pencil size={13} /> Edit wording yourself</summary>
    <div className="mt-3 grid gap-3">
      <label className="grid gap-1.5 text-xs">Activity prompt<Textarea value={prompt} disabled={isBusy} onChange={(event) => setPrompt(event.target.value)} /></label>
      <label className="grid gap-1.5 text-xs">Instructions<Textarea value={instructions} disabled={isBusy} onChange={(event) => setInstructions(event.target.value)} /></label>
      <label className="grid gap-1.5 text-xs">Explanation<Textarea value={explanation} disabled={isBusy} onChange={(event) => setExplanation(event.target.value)} /></label>
      <p className="text-[11px] text-muted-foreground">For changes to the exercise or answer key, describe the change to Claude above.</p>
      <Button size="sm" className="justify-self-end" disabled={isBusy || !hasChanges || !prompt.trim() || !instructions.trim() || !explanation.trim()} onClick={() => void onSave({ ...question, prompt, instructions, explanation })}>Save wording</Button>
    </div>
  </details>;
}

function parseSuggestion(snapshot: string | null | undefined) {
  if (!snapshot) return null;
  try { return homeworkQuestionSchema.parse(JSON.parse(snapshot)); }
  catch { return null; }
}
