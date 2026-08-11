import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, ArrowRight, Check, Copy, ExternalLink } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, humanizeIdentifier } from "@/lib/utils";
import { buildShareUrl, isPlayerPublished } from "@/lib/share-links";
import { emptyResponse, type PublicQuestionContent } from "@/homework/player/answer-types";
import { HomeworkWizard } from "@/homework/player/homework-wizard";
import { PromptContent } from "@/homework/player/prompt-content";
import { QuestionWidget } from "@/homework/player/question-widgets";

type PreviewMode = "student" | "answer";
type Draft = NonNullable<ReturnType<typeof useQuery<typeof api.assignments.getDraft>>>;
type DraftQuestion = Draft["questions"][number];

const SUMMARY_CLAMP_LENGTH = 260;
const VISIBLE_GOAL_COUNT = 3;

export function DraftReview({
  homeworkDraftId,
  generationActivity,
  onDiscarded,
  onPublished,
}: {
  homeworkDraftId: Id<"homeworkDrafts">;
  generationActivity?: ReactNode;
  onDiscarded: () => void;
  onPublished: () => void;
}) {
  const draft = useQuery(api.assignments.getDraft, { homeworkDraftId });
  const publish = useMutation(api.assignments.publish);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("student");
  const [dueDate, setDueDate] = useState("");
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [areAllGoalsVisible, setAreAllGoalsVisible] = useState(false);
  const publishErrorRef = useRef<HTMLParagraphElement>(null);

  if (draft === undefined) return <DraftReviewSkeleton />;
  if (draft === null) {
    return (
      <p className="mx-auto max-w-[1580px] px-6 py-8 text-[13px] lg:px-10">
        This draft is no longer available.
      </p>
    );
  }

  if (shareToken) {
    return (
      <PublishedState
        shareToken={shareToken}
        title={draft.title}
        hasCopied={hasCopied}
        onCopied={() => setHasCopied(true)}
        onDone={onPublished}
      />
    );
  }

  const selectedQuestion =
    draft.questions[Math.min(selectedQuestionIndex, draft.questions.length - 1)];

  async function publishDraft() {
    setIsPublishing(true);
    setPublishError(null);
    try {
      const published = await publish({
        homeworkDraftId,
        shareToken: crypto.randomUUID(),
        ...(dueDate ? { dueAt: endOfLocalDay(dueDate) } : {}),
      });
      setShareToken(published.shareToken);
    } catch (caught) {
      setPublishError(
        caught instanceof Error ? caught.message : "The assignment could not be published.",
      );
      window.requestAnimationFrame(() => publishErrorRef.current?.focus());
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <div className="phase-enter mx-auto grid max-w-[1580px] gap-8 px-6 py-8 lg:px-10 xl:grid-cols-[minmax(19rem,23rem)_minmax(0,1fr)] xl:gap-10 2xl:grid-cols-[minmax(22rem,26rem)_minmax(0,1fr)] 2xl:gap-14 2xl:px-12">
      <ScrollArea
        className="xl:sticky xl:top-[calc(var(--page-header-height)+1rem)] xl:max-h-[calc(100dvh-var(--page-header-height)-3rem)]"
        viewportClassName="xl:max-h-[calc(100dvh-var(--page-header-height)-3rem)] xl:pr-3"
      >
        <aside className="grid content-start gap-7 pb-2">
          <div>
            <Button variant="ghost" size="sm" onClick={onDiscarded}>
              <ArrowLeft size={14} aria-hidden /> Library
            </Button>
          </div>

          <section className="grid gap-3">
            <SectionHeading
              title="Assignment"
              action={<span className="text-[13px] text-muted-foreground">Private draft</span>}
            />
            <div className="panel overflow-hidden">
              <div className="px-5 py-5 xl:px-6">
                <h3 className="text-balance text-[19px] font-semibold leading-6 tracking-[-0.03em] xl:text-[21px] xl:leading-7">
                  {draft.title}
                </h3>
                <p
                  className={cn(
                    "mt-3 text-pretty text-[13.5px] leading-6 text-muted-foreground",
                    !isSummaryExpanded && "line-clamp-4",
                  )}
                >
                  {draft.summary}
                </p>
                {draft.summary.length > SUMMARY_CLAMP_LENGTH ? (
                  <button
                    type="button"
                    className="mt-1 min-h-8 text-[13px] font-medium text-primary hover:underline"
                    onClick={() => setIsSummaryExpanded((isExpanded) => !isExpanded)}
                  >
                    {isSummaryExpanded ? "Show less" : "Read full brief"}
                  </button>
                ) : null}
                <p className="mt-3 text-[12.5px] leading-5 text-muted-foreground numeric">
                  {draft.estimatedMinutes} minutes · {draft.questions.length} activities
                  {draft.studentName ? ` · For ${draft.studentName}` : ""}
                </p>
              </div>

              {draft.learningObjectives.length > 0 ? (
                <div className="border-t border-border/70 px-5 py-5 xl:px-6">
                  <p className="text-[13px] font-medium text-foreground">Learning goals</p>
                  <ul className="mt-3 grid gap-2.5 pl-4">
                    {draft.learningObjectives
                      .slice(0, areAllGoalsVisible ? undefined : VISIBLE_GOAL_COUNT)
                      .map((objective) => (
                        <li
                          key={objective}
                          className="list-disc text-pretty text-[13px] leading-5 text-muted-foreground marker:text-primary"
                        >
                          {objective}
                        </li>
                      ))}
                  </ul>
                  {draft.learningObjectives.length > VISIBLE_GOAL_COUNT ? (
                    <button
                      type="button"
                      className="mt-2 min-h-8 text-[13px] font-medium text-primary hover:underline"
                      onClick={() => setAreAllGoalsVisible((areVisible) => !areVisible)}
                    >
                      {areAllGoalsVisible
                        ? "Show fewer goals"
                        : `${draft.learningObjectives.length - VISIBLE_GOAL_COUNT} more goals`}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          {generationActivity}

          <section className="grid gap-3">
            <SectionHeading title="Publish" />
            <div className="panel overflow-hidden">
              <div className="px-5 py-5 xl:px-6">
                <Field>
                  <FieldLabel htmlFor="draft-due-date">Due date</FieldLabel>
                  <Input
                    id="draft-due-date"
                    type="date"
                    min={todayDateInputValue()}
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                  <FieldDescription>
                    Students see this date. Access stays open until you close it.
                  </FieldDescription>
                </Field>
              </div>
              {publishError ? (
                <p
                  ref={publishErrorRef}
                  role="alert"
                  tabIndex={-1}
                  className="border-t border-destructive/15 bg-critical-soft px-5 py-3 text-[12.5px] leading-5 text-destructive outline-none xl:px-6"
                >
                  {publishError} Check your connection and try again.
                </p>
              ) : null}
              <div className="border-t border-border/70 px-5 py-4 xl:px-6">
                <Button
                  size="xl"
                  className="w-full"
                  disabled={isPublishing}
                  onClick={() => void publishDraft()}
                >
                  {isPublishing ? "Publishing…" : "Publish & get link"}
                </Button>
              </div>
            </div>
          </section>

          <section className="grid gap-3">
            <SectionHeading
              title="Activity outline"
              action={
                <span className="text-[13px] text-muted-foreground numeric">
                  {draft.questions.length} total
                </span>
              }
            />
            <div className="panel overflow-hidden">
              {draft.questions.map((question, index) => (
                <button
                  key={question._id}
                  type="button"
                  aria-current={selectedQuestionIndex === index ? "step" : undefined}
                  onClick={() => setSelectedQuestionIndex(index)}
                  className={cn(
                    "flex min-h-14 w-full items-start gap-3 border-t border-border/70 px-4 py-3 text-left outline-none transition-colors duration-150 first:border-t-0 focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring xl:px-5",
                    selectedQuestionIndex === index ? "bg-primary-soft" : "hover:bg-muted/55",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 w-5 text-[12px] font-medium numeric",
                      selectedQuestionIndex === index ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-pretty text-[13px] font-medium leading-5">
                      {question.prompt}
                    </span>
                    <span className="mt-1 block text-[12px] capitalize text-muted-foreground">
                      {question.type.replaceAll("_", " ")} · {question.points} pts
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </ScrollArea>

      <section className="min-w-0">
        <SectionHeading
          title="Student preview"
          description="The exact wizard your student will use."
          action={
            <Tabs
              value={previewMode}
              onValueChange={(value) => setPreviewMode(value as PreviewMode)}
            >
              <TabsList aria-label="Preview mode">
                <TabsTrigger value="student" className="px-3.5 text-[12.5px] transition-none">
                  Student view
                </TabsTrigger>
                <TabsTrigger value="answer" className="px-3.5 text-[12.5px] transition-none">
                  Answer key
                </TabsTrigger>
              </TabsList>
            </Tabs>
          }
          className="mb-3"
        />

        {selectedQuestion ? (
          <QuestionPreview
            key={selectedQuestion._id}
            question={selectedQuestion}
            index={selectedQuestionIndex}
            questionCount={draft.questions.length}
            mode={previewMode}
            onPrevious={() => setSelectedQuestionIndex((current) => Math.max(0, current - 1))}
            onNext={() =>
              setSelectedQuestionIndex((current) =>
                Math.min(draft.questions.length - 1, current + 1),
              )
            }
          />
        ) : (
          <div className="panel px-6 py-8 text-sm text-muted-foreground">
            This draft has no activities.
          </div>
        )}
      </section>
    </div>
  );
}

function QuestionPreview({
  question,
  index,
  questionCount,
  mode,
  onPrevious,
  onNext,
}: {
  question: DraftQuestion;
  index: number;
  questionCount: number;
  mode: PreviewMode;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const publicContent = useMemo(() => toPreviewContent(question.content), [question.content]);
  const [response, setResponse] = useState(() => emptyResponse(publicContent));

  return (
    <HomeworkWizard
      currentStep={index + 1}
      totalSteps={questionCount}
      eyebrow={question.type.replaceAll("_", " ")}
      meta={
        <span className="numeric">
          {question.points} {question.points === 1 ? "point" : "points"}
        </span>
      }
      className="min-h-[40rem]"
      prompt={
        <PromptContent
          prompt={question.prompt}
          size="md"
          headingLevel={3}
          className="mt-2.5"
        />
      }
      instructions={question.instructions}
      supplement={
        mode === "answer" ? (
          <div className="mt-8 rounded-xl border border-primary/20 bg-primary-soft/50 px-4 py-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-primary">
              Teacher answer key
            </p>
            {question.correctAnswer ? (
              <p className="mt-2 whitespace-pre-line text-pretty text-[13px] font-medium leading-6 text-secondary-foreground">
                {question.correctAnswer}
              </p>
            ) : (
              <p className="mt-2 text-[13px] text-secondary-foreground">
                Review this written response manually.
              </p>
            )}
            <p className="mt-2 text-pretty text-[13px] leading-6 text-muted-foreground">
              {question.explanation}
            </p>
            {question.skillTags.length > 0 ? (
              <p className="mt-3 text-pretty text-[13px] leading-5 text-muted-foreground">
                <span className="font-medium text-foreground">Skills:</span>{" "}
                {question.skillTags.map(humanizeIdentifier).join(", ")}
              </p>
            ) : null}
          </div>
        ) : null
      }
      back={
        <Button variant="ghost" size="xl" disabled={index === 0} onClick={onPrevious}>
          <ArrowLeft size={16} aria-hidden /> Previous
        </Button>
      }
      next={
        <Button size="xl" disabled={index === questionCount - 1} onClick={onNext}>
          Next <ArrowRight size={16} aria-hidden />
        </Button>
      }
    >
      <QuestionWidget content={publicContent} response={response} onChange={setResponse} />
    </HomeworkWizard>
  );
}

function PublishedState({
  shareToken,
  title,
  hasCopied,
  onCopied,
  onDone,
}: {
  shareToken: string;
  title: string;
  hasCopied: boolean;
  onCopied: () => void;
  onDone: () => void;
}) {
  const shareUrl = buildShareUrl(shareToken);
  return (
    <div className="phase-enter mx-auto grid max-w-3xl gap-5 px-6 py-14 lg:px-10 xl:py-20">
      <div className="panel px-7 py-7 sm:px-10 sm:py-10">
        <div className="grid size-11 place-items-center rounded-full bg-primary-soft text-primary">
          <Check size={19} strokeWidth={2.5} aria-hidden />
        </div>
        <p className="mt-6 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-primary">
          Published
        </p>
        <h2 className="mt-2 text-balance text-[25px] font-semibold leading-8 tracking-[-0.04em] xl:text-[28px]">
          {title}
        </h2>
        <p className="mt-3 text-pretty text-[13.5px] leading-6 text-muted-foreground">
          The assignment is published. Send the link when you’re ready.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Input readOnly value={shareUrl} className="font-mono text-[12.5px]" />
          <Button
            variant="outline"
            size="xl"
            onClick={() => {
              void navigator.clipboard.writeText(shareUrl);
              onCopied();
            }}
          >
            {hasCopied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
            {hasCopied ? "Copied" : "Copy link"}
          </Button>
          <Button
            variant="ghost"
            size="xl"
            nativeButton={false}
            render={<a href={shareUrl} target="_blank" rel="noopener noreferrer" />}
          >
            <ExternalLink size={14} aria-hidden /> Preview
          </Button>
        </div>

        {!isPlayerPublished() ? (
          <p className="mt-4 text-pretty text-[12.5px] leading-5 text-muted-foreground">
            This is a local preview link. Publish the student player to a public URL before sharing
            it outside this machine.
          </p>
        ) : null}
      </div>
      <div>
        <Button size="xl" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

function DraftReviewSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading draft"
      className="mx-auto grid max-w-[1580px] gap-8 px-6 py-8 lg:px-10 xl:grid-cols-[minmax(19rem,23rem)_minmax(0,1fr)] xl:gap-10 2xl:grid-cols-[minmax(22rem,26rem)_minmax(0,1fr)] 2xl:gap-14 2xl:px-12"
    >
      <div className="grid content-start gap-7">
        <Skeleton className="h-7 w-24 rounded-2xl" />
        <div className="panel grid gap-3 px-5 py-5">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-2.5 w-5/6" />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
        <div className="panel grid gap-3 px-5 py-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-2xl" />
        </div>
      </div>
      <div className="panel grid min-h-[34rem] content-start gap-4 px-6 py-6">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="mt-4 grid gap-2.5">
          <Skeleton className="h-13 w-full rounded-xl" />
          <Skeleton className="h-13 w-full rounded-xl" />
          <Skeleton className="h-13 w-full rounded-xl" />
          <Skeleton className="h-13 w-full rounded-xl" />
        </div>
      </div>
      <span className="sr-only">Loading draft</span>
    </div>
  );
}

function toPreviewContent(content: DraftQuestion["content"]): PublicQuestionContent {
  if (content.kind === "multiple_choice") {
    return { kind: "multiple_choice", choices: content.choices };
  }
  if (content.kind === "fill_blank") {
    return { kind: "fill_blank", text: content.text, blankCount: content.blanks.length };
  }
  if (content.kind === "matching") {
    return {
      kind: "matching",
      lefts: content.pairs.map((pair) => pair.left),
      rights: content.pairs
        .map((pair) => pair.right)
        .toSorted((left, right) => left.localeCompare(right)),
    };
  }
  return { kind: "open_response" };
}

function todayDateInputValue() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function endOfLocalDay(value: string) {
  return new Date(`${value}T23:59:59.999`).getTime();
}
