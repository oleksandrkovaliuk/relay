import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { ArrowLeft, ArrowRight, Check, Copy, ExternalLink, ListChecks, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { toPublicContent } from "@convex/content";
import { PageHeader } from "@/app/workspace-shell";
import { SectionHeading } from "@/components/section-heading";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, humanizeIdentifier } from "@/lib/utils";
import { buildShareUrl, isPlayerPublished } from "@/lib/share-links";
import { Switch } from "@/components/ui/switch";
import { FieldTitle } from "@/components/ui/field";
import {
  emptyResponse,
  groupQuestionsIntoSections,
  type QuestionSection,
} from "@/homework/player/answer-types";
import { HomeworkWizard } from "@/homework/player/homework-wizard";
import { PromptContent } from "@/homework/player/prompt-content";
import { ReferenceRules, type ReferenceRule } from "@/homework/player/reference-rules";
import { QuestionWidget } from "@/homework/player/question-widgets";
import { HomeworkGlyph } from "@/homework/homework-glyph";
import { AttachToMiroButton } from "@/homework/assignment/attach-to-miro-button";
import { StudentMultiPicker } from "@/homework/assignment/student-multi-picker";
import { ClaudeQuestionIsland } from "./claude-question-island";
import { homeworkQuestionSchema, type HomeworkQuestion } from "@/shared/claude";

type PreviewMode = "student" | "answer";
type Draft = NonNullable<
  ReturnType<typeof useQuery<typeof api.assignments.getDraft>>
>;
type DraftQuestion = Draft["questions"][number];

const SUMMARY_CLAMP_LENGTH = 260;
/** Deleting is paged; this is the ceiling on how many pages to walk. */
const MAXIMUM_DELETE_PASSES = 40;
const VISIBLE_GOAL_COUNT = 3;

export function DraftReview({
  homeworkDraftId,
  initialStudentIds,
  generationActivity,
  onDiscarded,
  onPublished,
}: {
  homeworkDraftId: Id<"homeworkDrafts">;
  /** Assignees chosen in the brief, carried into the publish step. */
  initialStudentIds?: Id<"students">[];
  generationActivity?: ReactNode;
  onDiscarded: () => void;
  onPublished: () => void;
}) {
  const draft = useQuery(api.assignments.getDraft, { homeworkDraftId });
  const students = useQuery(api.students.list);
  const publish = useMutation(api.assignments.publish);
  const closeAssignment = useMutation(api.assignments.close);
  const replaceQuestion = useMutation(api.assignments.replaceQuestion);
  const setAssignees = useMutation(api.assignments.setAssignees);
  const setSelfCheck = useMutation(api.assignments.setSelfCheck);
  const reopenAssignment = useMutation(api.assignments.reopen);
  const removeHomework = useMutation(api.assignments.remove);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("student");
  const [dueDate, setDueDate] = useState("");
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [areAllGoalsVisible, setAreAllGoalsVisible] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<
    Id<"students">[]
  >([]);
  const publishErrorRef = useRef<HTMLParagraphElement>(null);

  useEffect(
    function adoptAssignees() {
      if (!draft) return;
      // A published set is the source of truth; an unpublished one keeps whatever
      // the brief already chose.
      const assigned = draft.assignedStudents.map((student) => student._id);
      setSelectedStudentIds(
        assigned.length > 0 || !initialStudentIds?.length
          ? assigned
          : initialStudentIds,
      );
    },
    [draft, initialStudentIds],
  );

  if (draft === undefined || students === undefined) {
    return (
      <>
        <DraftPageHeader />
        <DraftReviewSkeleton />
      </>
    );
  }
  if (draft === null) {
    return (
      <>
        <DraftPageHeader />
        <p className="mx-auto max-w-[1580px] px-6 py-8 text-[13px] lg:px-10">
          This draft is no longer available.
        </p>
      </>
    );
  }

  if (shareToken) {
    return (
      <>
        <DraftPageHeader />
        <PublishedState
          shareToken={shareToken}
          title={draft.title}
          hasCopied={hasCopied}
          onCopied={() => setHasCopied(true)}
          onDone={onPublished}
        />
      </>
    );
  }

  const isClosedToStudents = draft.publication?.status === "closed";
  const sections = groupQuestionsIntoSections(draft.questions);
  const selectedQuestion =
    draft.questions[
      Math.min(selectedQuestionIndex, draft.questions.length - 1)
    ];
  const selectedSectionIndex = Math.max(
    0,
    sections.findIndex((section) =>
      section.questions.some((question) => question._id === selectedQuestion?._id),
    ),
  );
  const selectedSection = sections[selectedSectionIndex];
  /** Only assignees who actually have a board can receive the homework on one. */
  const assignedBoards = students.flatMap((student) =>
    selectedStudentIds.includes(student._id) && student.miroBoardUrl
      ? [{ studentName: student.name, miroBoardUrl: student.miroBoardUrl }]
      : [],
  );

  async function publishDraft() {
    setIsPublishing(true);
    setPublishError(null);
    try {
      const published = await publish({
        homeworkDraftId,
        shareToken: crypto.randomUUID(),
        studentIds: selectedStudentIds,
        ...(dueDate ? { dueAt: endOfLocalDay(dueDate) } : {}),
      });
      setIsPublishDialogOpen(false);
      setShareToken(published.shareToken);
    } catch (caught) {
      setPublishError(
        caught instanceof Error
          ? caught.message
          : "The assignment could not be published.",
      );
      window.requestAnimationFrame(() => publishErrorRef.current?.focus());
    } finally {
      setIsPublishing(false);
    }
  }

  async function saveAssignees(studentIds: Id<"students">[]) {
    setSelectedStudentIds(studentIds);
    const publication = draft?.publication;
    if (!publication) return;
    await setAssignees({ assignmentId: publication.assignmentId, studentIds });
  }

  async function reopenStudentAccess() {
    const publication = draft?.publication;
    if (!publication) return;
    setIsReopening(true);
    try {
      await reopenAssignment({ assignmentId: publication.assignmentId });
    } finally {
      setIsReopening(false);
    }
  }

  /**
   * Deleting is bounded per call, so it is repeated until the backend reports
   * itself finished. Leaving the page afterwards is the point: what it was
   * showing no longer exists.
   */
  async function deleteHomework() {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      for (let attempt = 0; attempt < MAXIMUM_DELETE_PASSES; attempt += 1) {
        const result = await removeHomework({ homeworkDraftId });
        if (result.isComplete) {
          setIsDeleteDialogOpen(false);
          onDiscarded();
          return;
        }
      }
      setDeleteError("This homework has more history than one delete could clear. Try again.");
    } catch (caught) {
      setDeleteError(
        caught instanceof Error ? caught.message : "Could not delete this homework.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  async function closeStudentAccess() {
    const publication = draft?.publication;
    if (!publication) return;
    setIsClosing(true);
    try {
      await closeAssignment({ assignmentId: publication.assignmentId });
      setIsCloseDialogOpen(false);
    } finally {
      setIsClosing(false);
    }
  }

  async function applyClaudeRevision(
    questionId: Id<"homeworkQuestions">,
    question: HomeworkQuestion,
  ) {
    await replaceQuestion({
      questionId,
      question: {
        type: question.type,
        prompt: question.prompt,
        instructions: question.instructions,
        content: question.content,
        skillTags: question.skillTags,
        points: question.points,
        difficulty: question.difficulty,
        explanation: question.explanation,
        ...(question.set ? { set: question.set } : {}),
      },
    });
  }

  return (
    <>
      <DraftPageHeader
        action={
          draft.publication ? (
            <div className="flex items-center gap-2.5">
              {/* Closing used to leave the page looking exactly as it did before,
                  so the only way to tell it had worked was the library. */}
              {isClosedToStudents ? (
                <span className="rounded-full bg-muted px-2.5 py-1 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-secondary-foreground">
                  Closed to students
                </span>
              ) : null}
              <Button
                variant="ghost"
                nativeButton={false}
                render={
                  <a
                    href={buildShareUrl(draft.publication.shareToken)}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <ExternalLink size={14} aria-hidden />{" "}
                {isClosedToStudents ? "Preview link" : "Student link"}
              </Button>
              {isClosedToStudents ? (
                <Button disabled={isReopening} onClick={() => void reopenStudentAccess()}>
                  {isReopening ? "Reopening…" : "Reopen access"}
                </Button>
              ) : (
                <Button variant="destructive" onClick={() => setIsCloseDialogOpen(true)}>
                  Close access
                </Button>
              )}
            </div>
          ) : (
            <Button size="lg" onClick={() => setIsPublishDialogOpen(true)}>
              Publish
            </Button>
          )
        }
      />
      {/* The same shell as the builder: one back link across the top, then two
          columns in the same 0.85 : 1 relationship whose headings share a
          baseline. */}
      <div className="mx-auto w-full max-w-[1580px] px-6 py-8 lg:px-10 xl:py-10 2xl:px-12">
      <div className="mb-5">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          onClick={onDiscarded}
        >
          <ArrowLeft size={14} aria-hidden /> Library
        </Button>
      </div>

      <div className="grid gap-10 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] 2xl:gap-14">
        <aside className="grid content-start gap-7 pb-2">
          <section className="grid gap-3">
            <SectionHeading
              title="Assignment"
              description="The brief this set was generated from, and who receives it."
              action={
                <span className="text-[13px] text-muted-foreground">
                  Private draft
                </span>
              }
            />
            <div className="panel overflow-hidden">
              <div className="px-5 py-5 xl:px-6">
                <div className="flex items-start gap-3">
                  <HomeworkGlyph id={draft._id} />
                  <h3 className="text-balance text-[19px] font-semibold leading-6 tracking-[-0.03em] xl:text-[21px] xl:leading-7">
                    {draft.title}
                  </h3>
                </div>
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
                    onClick={() =>
                      setIsSummaryExpanded((isExpanded) => !isExpanded)
                    }
                  >
                    {isSummaryExpanded ? "Show less" : "Read full brief"}
                  </button>
                ) : null}
                <p className="mt-3 text-[12.5px] leading-5 text-muted-foreground numeric">
                  {draft.estimatedMinutes} minutes · {draft.questions.length}{" "}
                  activities
                  {draft.assignedStudents.length === 1
                    ? ` · For ${draft.assignedStudents[0]!.name}`
                    : draft.assignedStudents.length > 1
                      ? ` · For ${draft.assignedStudents.length} students`
                      : ""}
                </p>
              </div>

              {draft.learningObjectives.length > 0 ? (
                <div className="border-t border-border/70 px-5 py-5 xl:px-6">
                  <p className="text-[13px] font-medium text-foreground">
                    Learning goals
                  </p>
                  <ul className="mt-3 grid gap-2.5 pl-4">
                    {draft.learningObjectives
                      .slice(
                        0,
                        areAllGoalsVisible ? undefined : VISIBLE_GOAL_COUNT,
                      )
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
                      onClick={() =>
                        setAreAllGoalsVisible((areVisible) => !areVisible)
                      }
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

          <section className="grid gap-3">
            <SectionHeading
              title="Student experience"
              description="How the set behaves while a student works through it."
            />
            <div className="panel px-5 py-4 xl:px-6">
              <div className="flex items-start justify-between gap-5">
                <div className="min-w-0">
                  <FieldTitle>Let students check each section</FieldTitle>
                  <p className="mt-1 text-pretty text-[12.5px] leading-5 text-muted-foreground">
                    A “Check section” button marks what they have answered so far as right
                    or wrong, without showing the answers, so they can fix mistakes before
                    moving on. Turn it off for a set you want answered once, like a test.
                  </p>
                </div>
                <Switch
                  checked={draft.selfCheckEnabled}
                  onCheckedChange={(isEnabled) =>
                    void setSelfCheck({ homeworkDraftId, selfCheckEnabled: isEnabled })
                  }
                  aria-label="Let students check each section"
                  className="mt-0.5 shrink-0"
                />
              </div>
            </div>
          </section>

          {generationActivity}

          {draft.publication ? (
            <section className="grid gap-3">
              <SectionHeading
                title="Published"
                description="Edits save straight to the live student assignment."
              />
              <div className="panel grid gap-3 px-5 py-5 xl:px-6">
                <AttachToMiroButton
                  boards={assignedBoards}
                  title={draft.title}
                  summary={draft.summary}
                  shareUrl={buildShareUrl(draft.publication.shareToken)}
                />
              </div>
            </section>
          ) : (
            /* Publishing itself lives in the header. This says what the button
               up there will do, which the button alone cannot. */
            <p className="text-pretty text-[12.5px] leading-5 text-muted-foreground">
              Nothing is shared yet. Publishing creates the student link and lets you set a
              due date.
            </p>
          )}

          <div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setDeleteError(null);
                setIsDeleteDialogOpen(true);
              }}
            >
              <Trash2 size={14} aria-hidden /> Delete this homework
            </Button>
          </div>

          <section className="grid gap-3">
            <SectionHeading
              title="Activity outline"
              description="Grouped into the sections your student answers one screen at a time."
              action={
                <span className="text-[13px] text-muted-foreground numeric">
                  {sections.length} {sections.length === 1 ? "section" : "sections"} ·{" "}
                  {draft.questions.length} total
                </span>
              }
            />
            <div className="panel overflow-hidden">
              {sections.map((section) => (
                <div key={section.key}>
                  <div className="flex items-baseline justify-between gap-3 border-t border-border/70 bg-muted/45 px-4 py-2 first:border-t-0 xl:px-5">
                    <p className="min-w-0 truncate text-[12px] font-semibold uppercase tracking-[0.07em] text-secondary-foreground">
                      {section.title}
                    </p>
                    <span className="shrink-0 text-[11.5px] text-muted-foreground numeric">
                      {section.questions.length}
                    </span>
                  </div>
                  {section.questions.map((question, positionInSection) => {
                    const index = section.firstActivityNumber - 1 + positionInSection;
                    return (
                      <button
                        key={question._id}
                        type="button"
                        aria-current={
                          selectedQuestionIndex === index ? "step" : undefined
                        }
                        onClick={() => setSelectedQuestionIndex(index)}
                        className={cn(
                          "flex min-h-14 w-full items-start gap-3 border-t border-border/70 px-4 py-3 text-left outline-none transition-colors duration-150 focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring xl:px-5",
                          selectedQuestionIndex === index
                            ? "bg-primary-soft"
                            : "hover:bg-muted/55",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 w-5 text-[12px] font-medium numeric",
                            selectedQuestionIndex === index
                              ? "text-primary"
                              : "text-muted-foreground",
                          )}
                        >
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0">
                          <span className="line-clamp-2 text-pretty text-[13px] font-medium leading-5">
                            {question.prompt}
                          </span>
                          <span className="mt-1 block text-[12px] capitalize text-muted-foreground">
                            {question.type.replaceAll("_", " ")} · {question.points}{" "}
                            pts
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="min-w-0 2xl:sticky 2xl:top-[calc(var(--page-header-height)+1rem)] 2xl:self-start">
          <SectionHeading
            title="Student preview"
            description="The exact wizard your student will use."
            action={
              <div className="flex items-center gap-2">
                <Tabs
                  value={previewMode}
                  onValueChange={(value) =>
                    setPreviewMode(value as PreviewMode)
                  }
                >
                  <TabsList aria-label="Preview mode">
                    <TabsTrigger
                      value="student"
                      className="px-3.5 text-[12.5px] transition-none"
                    >
                      Student view
                    </TabsTrigger>
                    <TabsTrigger
                      value="answer"
                      className="px-3.5 text-[12.5px] transition-none"
                    >
                      Answer key
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            }
            className="mb-3"
          />

          {selectedQuestion && selectedSection ? (
            <SectionPreview
              key={selectedSection.key}
              homeworkDraftId={homeworkDraftId}
              section={selectedSection}
              sectionIndex={selectedSectionIndex}
              sectionCount={sections.length}
              referenceRules={draft.referenceRules}
              isSelfCheckEnabled={draft.selfCheckEnabled}
              selectedQuestion={selectedQuestion}
              mode={previewMode}
              homeworkTitle={draft.title}
              homeworkSummary={draft.summary}
              neighboringPrompts={neighboringQuestionPrompts(
                draft.questions,
                selectedQuestionIndex,
              )}
              onApplyClaudeRevision={applyClaudeRevision}
              onSelectQuestionIndex={setSelectedQuestionIndex}
              onGoToSection={(nextSectionIndex) => {
                const nextSection = sections[nextSectionIndex];
                if (nextSection) setSelectedQuestionIndex(nextSection.firstActivityNumber - 1);
              }}
            />
          ) : (
            <div className="panel px-6 py-8 text-sm text-muted-foreground">
              This draft has no activities.
            </div>
          )}
        </section>
      </div>
    </div>

      <Dialog
        open={isPublishDialogOpen}
        onOpenChange={(isOpen) => {
          if (!isPublishing) setIsPublishDialogOpen(isOpen);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish this homework</DialogTitle>
            <DialogDescription>
              This creates the student link. Access stays open until you close it.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel>Who receives it</FieldLabel>
            <StudentMultiPicker
              students={students}
              value={selectedStudentIds}
              onValueChange={(studentIds) => void saveAssignees(studentIds)}
            />
            <FieldDescription>
              Optional. A set is not tied to one learner — assign it to as many as you like.
            </FieldDescription>
          </Field>
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
              Optional. Students see this date; it does not close the link.
            </FieldDescription>
          </Field>
          {publishError ? (
            <p
              ref={publishErrorRef}
              role="alert"
              tabIndex={-1}
              className="rounded-xl bg-critical-soft px-3.5 py-2.5 text-[12.5px] leading-5 text-destructive outline-none"
            >
              {publishError} Check your connection and try again.
            </p>
          ) : null}
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={isPublishing}
              onClick={() => setIsPublishDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button disabled={isPublishing} onClick={() => void publishDraft()}>
              {isPublishing ? "Publishing…" : "Publish & get link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(isOpen) => {
          if (!isDeleting) setIsDeleteDialogOpen(isOpen);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this homework?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{draft.title}&rdquo; and all {draft.questions.length} of its activities are
              removed for good.
              {draft.publication
                ? " The student link stops working, and every attempt at it — answers, scores and ratings — is deleted with it."
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <p role="alert" className="text-[12.5px] leading-5 text-destructive">
              {deleteError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              disabled={isDeleting}
              onClick={() => void deleteHomework()}
            >
              {isDeleting ? "Deleting…" : "Delete homework"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isCloseDialogOpen}
        onOpenChange={(isOpen) => {
          if (!isClosing) setIsCloseDialogOpen(isOpen);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close student access?</AlertDialogTitle>
            <AlertDialogDescription>
              The link for “{draft.title}” stops working immediately. Work already submitted
              stays available.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClosing}>Keep open</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              disabled={isClosing}
              onClick={() => void closeStudentAccess()}
            >
              {isClosing ? "Closing…" : "Close access"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** One header for every state of this page, so the title never jumps. */
function DraftPageHeader({ action }: { action?: ReactNode }) {
  return (
    <PageHeader
      title="Homework details"
      description="Preview the student experience, edit the activities, and manage who it is assigned to."
      action={action}
    />
  );
}

/**
 * The section the student actually meets, drawn whole: every activity in it, in
 * order, in the same frame they use. The teacher still edits one activity at a
 * time — the selected one carries the Claude island — but they read it in the
 * run it belongs to, because a ten-sentence section walked one screen at a time
 * hides the very thing a teacher checks: whether the ten are any good together.
 */
function SectionPreview({
  homeworkDraftId,
  section,
  sectionIndex,
  sectionCount,
  referenceRules,
  isSelfCheckEnabled,
  selectedQuestion,
  mode,
  homeworkTitle,
  homeworkSummary,
  neighboringPrompts,
  onApplyClaudeRevision,
  onSelectQuestionIndex,
  onGoToSection,
}: {
  homeworkDraftId: Id<"homeworkDrafts">;
  section: QuestionSection<DraftQuestion>;
  sectionIndex: number;
  sectionCount: number;
  /** The cheat sheet, shown where the student gets it: above the work. */
  referenceRules: ReferenceRule[];
  /** Whether the student's own "Check section" button appears on this screen. */
  isSelfCheckEnabled: boolean;
  /** The activity the Claude island edits, always one inside this section. */
  selectedQuestion: DraftQuestion;
  mode: PreviewMode;
  homeworkTitle: string;
  homeworkSummary: string;
  neighboringPrompts: string[];
  onApplyClaudeRevision: (
    questionId: Id<"homeworkQuestions">,
    question: HomeworkQuestion,
  ) => Promise<void>;
  onSelectQuestionIndex: (index: number) => void;
  onGoToSection: (sectionIndex: number) => void;
}) {
  const sectionPoints = section.questions.reduce(
    (total, question) => total + question.points,
    0,
  );

  return (
    <HomeworkWizard
      currentStep={sectionIndex + 1}
      totalSteps={sectionCount}
      stepNoun="Section"
      eyebrow={`${section.questions.length} ${section.questions.length === 1 ? "activity" : "activities"}`}
      meta={
        <span className="numeric">
          {sectionPoints} {sectionPoints === 1 ? "point" : "points"}
        </span>
      }
      className="min-h-[40rem]"
      /* Room for the island, which floats above the footer over the last
         activity in a long section. */
      bodyClassName="pb-24"
      /* Everything the student's screen carries, in the order they meet it. */
      aside={referenceRules.length > 0 ? <ReferenceRules rules={referenceRules} /> : null}
      /* The same heading treatment the student gets, from the same component. */
      prompt={
        <PromptContent
          prompt={section.title}
          size="lg"
          headingLevel={3}
          className="mt-2.5"
        />
      }
      instructions={section.task}
      floatingPanel={
        <div className="mx-auto max-w-[42rem]">
          <ClaudeQuestionIsland
            key={selectedQuestion._id}
            homeworkDraftId={homeworkDraftId}
            homeworkTitle={homeworkTitle}
            homeworkSummary={homeworkSummary}
            question={toHomeworkQuestion(selectedQuestion)}
            questionId={selectedQuestion._id}
            neighboringPrompts={neighboringPrompts}
            onApply={onApplyClaudeRevision}
          />
        </div>
      }
      back={
        <Button
          variant="ghost"
          size="xl"
          disabled={sectionIndex === 0}
          onClick={() => onGoToSection(sectionIndex - 1)}
        >
          <ArrowLeft size={16} aria-hidden /> Previous section
        </Button>
      }
      next={
        <>
          {/* Shown, never wired: this is the student's control, and a teacher
              needs to see that it is there — and that turning it off removes it. */}
          {isSelfCheckEnabled && section.questions.some((question) => question.type !== "short_answer" && question.type !== "rewrite") ? (
            <Button variant="outline" size="xl" disabled title="Your student checks the section here">
              <ListChecks size={16} aria-hidden /> Check section
            </Button>
          ) : null}
          <Button
            size="xl"
            disabled={sectionIndex >= sectionCount - 1}
            onClick={() => onGoToSection(sectionIndex + 1)}
          >
            Next section <ArrowRight size={16} aria-hidden />
          </Button>
        </>
      }
    >
      <ol className="grid gap-6">
        {section.questions.map((question, positionInSection) => (
          <PreviewActivity
            key={question._id}
            question={question}
            number={positionInSection + 1}
            sectionTask={section.task}
            mode={mode}
            isSelected={question._id === selectedQuestion._id}
            onSelect={() =>
              onSelectQuestionIndex(section.firstActivityNumber - 1 + positionInSection)
            }
          />
        ))}
      </ol>
    </HomeworkWizard>
  );
}

/**
 * One activity inside the previewed section. Selecting it is what points the
 * Claude island at it, so the whole row is a target rather than a small handle:
 * a teacher who spots the weak sentence should be able to click the sentence.
 */
function PreviewActivity({
  question,
  number,
  sectionTask,
  mode,
  isSelected,
  onSelect,
}: {
  question: DraftQuestion;
  number: number;
  /** Repeated instructions are noise once every activity sits under the task. */
  sectionTask: string;
  mode: PreviewMode;
  isSelected: boolean;
  onSelect: () => void;
}) {
  /**
   * The same conversion the student's assignment goes through, not a copy of it.
   * A second implementation here is how error_fix activities came to preview as
   * an empty text box: the copy had no branch for them and fell through to
   * open_response, so the teacher saw neither the sentence nor its flagged phrase.
   */
  const publicContent = useMemo(
    () => toPublicContent(question.content),
    [question.content],
  );
  const [response, setResponse] = useState(() => emptyResponse(publicContent));

  useEffect(function resetPreviewAnswerAfterRevision() {
    setResponse(emptyResponse(publicContent));
  }, [publicContent]);

  return (
    <li
      aria-current={isSelected ? "step" : undefined}
      className={cn(
        "-mx-3 rounded-2xl px-3 py-3 transition-colors duration-150",
        isSelected ? "bg-primary-soft/45 ring-1 ring-primary/25" : "hover:bg-muted/40",
      )}
    >
      <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3">
        <span
          className={cn(
            "mt-0.5 font-mono text-[12.5px] numeric",
            isSelected ? "text-primary" : "text-muted-foreground",
          )}
        >
          {number}.
        </span>
        <div className="min-w-0">
          {/* The prompt is the handle: clicking it aims the Claude island here. */}
          <button
            type="button"
            onClick={onSelect}
            className="block w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PromptContent prompt={question.prompt} size="sm" headingLevel={4} />
          </button>
          {/* The section's task line is already above every activity here. */}
          {question.instructions && question.instructions !== sectionTask ? (
            <p className="mt-1 text-pretty text-[12.5px] leading-5 text-muted-foreground">
              {question.instructions}
            </p>
          ) : null}
          <div className="mt-3">
            <QuestionWidget
              content={publicContent}
              response={response}
              onChange={setResponse}
            />
          </div>
          {mode === "answer" ? <AnswerKey question={question} /> : null}
        </div>
      </div>
    </li>
  );
}

/** What this activity expects, for the teacher only. */
function AnswerKey({ question }: { question: DraftQuestion }) {
  return (
    <div className="mt-3 rounded-xl border border-primary/20 bg-primary-soft/50 px-3.5 py-3">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-primary">
        Answer key
      </p>
      {question.correctAnswer ? (
        <p className="mt-1.5 whitespace-pre-line text-pretty text-[12.5px] font-medium leading-5 text-secondary-foreground">
          {question.correctAnswer}
        </p>
      ) : (
        <p className="mt-1.5 text-[12.5px] text-secondary-foreground">
          Review this written response manually.
        </p>
      )}
      <p className="mt-1.5 text-pretty text-[12.5px] leading-5 text-muted-foreground">
        {question.explanation}
      </p>
      {question.skillTags.length > 0 ? (
        <p className="mt-2 text-pretty text-[12px] leading-5 text-muted-foreground">
          <span className="font-medium text-foreground">Skills:</span>{" "}
          {question.skillTags.map(humanizeIdentifier).join(", ")}
        </p>
      ) : null}
    </div>
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
    <div className="mx-auto grid max-w-3xl gap-5 px-6 py-14 lg:px-10 xl:py-20">
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
          <Input
            readOnly
            value={shareUrl}
            className="font-mono text-[12.5px]"
          />
          <Button
            variant="outline"
            size="xl"
            onClick={() => {
              void navigator.clipboard.writeText(shareUrl);
              onCopied();
            }}
          >
            {hasCopied ? (
              <Check size={14} aria-hidden />
            ) : (
              <Copy size={14} aria-hidden />
            )}
            {hasCopied ? "Copied" : "Copy link"}
          </Button>
          <Button
            variant="ghost"
            size="xl"
            nativeButton={false}
            render={
              <a href={shareUrl} target="_blank" rel="noopener noreferrer" />
            }
          >
            <ExternalLink size={14} aria-hidden /> Preview
          </Button>
        </div>

        {!isPlayerPublished() ? (
          <p className="mt-4 text-pretty text-[12.5px] leading-5 text-muted-foreground">
            This is a local preview link. Publish the student player to a public
            URL before sharing it outside this machine.
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

/**
 * The review page drawn empty, column for column: the back link, the assignment
 * panel with its goals, the activity outline, and the wizard card beside them.
 * The real page must land in the same places it was promised.
 */
function DraftReviewSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading draft"
      className="mx-auto w-full max-w-[1580px] px-6 py-8 lg:px-10 xl:py-10 2xl:px-12"
    >
      <Skeleton className="mb-5 h-7 w-24 rounded-2xl" />
      <div className="grid gap-10 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] 2xl:gap-14">
        <div className="grid content-start gap-7">
          <div className="grid gap-3">
            <Skeleton className="h-4 w-28" />
            <div className="panel overflow-hidden">
              <div className="grid gap-3 px-5 py-5 xl:px-6">
                <div className="flex items-start gap-3">
                  <Skeleton className="size-9 shrink-0 rounded-xl" />
                  <Skeleton className="h-5 w-3/4" />
                </div>
                <Skeleton className="h-2.5 w-full" />
                <Skeleton className="h-2.5 w-5/6" />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
              <div className="grid gap-2.5 border-t border-border/70 px-5 py-5 xl:px-6">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-2.5 w-11/12" />
                <Skeleton className="h-2.5 w-4/5" />
                <Skeleton className="h-2.5 w-2/3" />
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <Skeleton className="h-4 w-32" />
            <div className="panel divide-y divide-border/70 overflow-hidden">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="flex items-start gap-3 px-4 py-3 xl:px-5">
                  <Skeleton className="mt-0.5 h-3 w-5" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-3 w-11/12" />
                    <Skeleton className="mt-2 h-2.5 w-28" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <Skeleton className="mb-3 h-4 w-32" />
          <div className="panel grid min-h-[40rem] content-start gap-4 px-6 py-6">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="mt-4 h-3 w-24" />
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="mt-4 grid gap-2.5">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-13 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
      <span className="sr-only">Loading draft</span>
    </div>
  );
}

function neighboringQuestionPrompts(
  questions: Draft["questions"],
  selectedIndex: number,
) {
  const firstNeighborIndex = Math.max(0, selectedIndex - 2);
  const lastNeighborIndex = Math.min(questions.length, selectedIndex + 3);
  return questions
    .slice(firstNeighborIndex, lastNeighborIndex)
    .filter((_, offset) => firstNeighborIndex + offset !== selectedIndex)
    .map((question) => question.prompt);
}

function toHomeworkQuestion(sourceQuestion: DraftQuestion) {
  return homeworkQuestionSchema.parse({
    id: sourceQuestion._id,
    type: sourceQuestion.type,
    prompt: sourceQuestion.prompt,
    instructions: sourceQuestion.instructions,
    content: sourceQuestion.content,
    skillTags: sourceQuestion.skillTags,
    points: sourceQuestion.points,
    difficulty: sourceQuestion.difficulty,
    explanation: sourceQuestion.explanation,
    ...(sourceQuestion.set ? { set: sourceQuestion.set } : {}),
  });
}

function todayDateInputValue() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function endOfLocalDay(value: string) {
  return new Date(`${value}T23:59:59.999`).getTime();
}
