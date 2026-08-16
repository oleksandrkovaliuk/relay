import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import {
  Add01Icon,
  ArrowUpRight01Icon,
  CheckmarkCircle02Icon,
  ClipboardListIcon,
  Copy01Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildShareUrl } from "@/lib/share-links";
import { HomeworkGlyph } from "@/homework/homework-glyph";
import { initials } from "@/lib/utils";
import { InProgressHomework } from "./in-progress-homework";

type HomeworkFilter = "all" | "published" | "drafts" | "closed";
type PublishedAssignment = NonNullable<
  ReturnType<typeof useQuery<typeof api.assignments.listPublished>>
>[number];
type HomeworkDraft = NonNullable<
  ReturnType<typeof useQuery<typeof api.assignments.listDrafts>>
>[number];

export function HomeworkLibrary({
  onCreate,
  onOpenDraft,
}: {
  onCreate: () => void;
  onOpenDraft: (homeworkDraftId: Id<"homeworkDrafts">) => void;
}) {
  const assignments = useQuery(api.assignments.listPublished);
  const drafts = useQuery(api.assignments.listDrafts);
  const closeAssignment = useMutation(api.assignments.close);
  const discardDraft = useMutation(api.assignments.discardDraft);
  const [filter, setFilter] = useState<HomeworkFilter>("all");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [copyFailureToken, setCopyFailureToken] = useState<string | null>(null);
  const [copyAnnouncement, setCopyAnnouncement] = useState("");
  const [assignmentToClose, setAssignmentToClose] = useState<PublishedAssignment | null>(null);
  const [draftToDiscard, setDraftToDiscard] = useState<HomeworkDraft | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [discardError, setDiscardError] = useState<string | null>(null);

  if (assignments === undefined || drafts === undefined) {
    return <LoadingState />;
  }

  const publishedAssignments = assignments.filter((assignment) => assignment.status === "published");
  const closedAssignments = assignments.filter((assignment) => assignment.status === "closed");
  const visibleDrafts = filter === "all" || filter === "drafts" ? drafts : [];
  const visibleAssignments = assignments.filter((assignment) => {
    if (filter === "all") return true;
    if (filter === "published") return assignment.status === "published";
    if (filter === "closed") return assignment.status === "closed";
    return false;
  });
  const hasVisibleHomework = visibleDrafts.length > 0 || visibleAssignments.length > 0;

  async function closeSelectedAssignment() {
    if (!assignmentToClose) return;
    setIsClosing(true);
    try {
      await closeAssignment({ assignmentId: assignmentToClose._id });
      setAssignmentToClose(null);
    } finally {
      setIsClosing(false);
    }
  }

  async function discardSelectedDraft() {
    if (!draftToDiscard) return;
    setIsDiscarding(true);
    setDiscardError(null);
    try {
      await discardDraft({ homeworkDraftId: draftToDiscard._id });
      setDraftToDiscard(null);
    } catch (caught) {
      setDiscardError(caught instanceof Error ? caught.message : "Could not clear this draft.");
    } finally {
      setIsDiscarding(false);
    }
  }

  async function copyShareLink(shareToken: string, shareUrl: string) {
    setCopyFailureToken(null);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedToken(shareToken);
      setCopyAnnouncement("Homework link copied.");
      window.setTimeout(() => {
        setCopiedToken((current) => (current === shareToken ? null : current));
      }, 2_000);
    } catch {
      setCopyFailureToken(shareToken);
      setCopyAnnouncement("Could not copy the homework link.");
    }
  }

  return (
    <div className="mx-auto grid max-w-[1480px] gap-8 px-6 py-8 lg:px-10 xl:gap-9 xl:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as HomeworkFilter)}>
          <TabsList aria-label="Filter homework">
            <TabsTrigger value="all" className="px-3.5 text-[13px] transition-none xl:text-sm">All</TabsTrigger>
            <TabsTrigger value="published" className="px-3.5 text-[13px] transition-none xl:text-sm">
              Published <span className="text-foreground/65 numeric">{publishedAssignments.length}</span>
            </TabsTrigger>
            <TabsTrigger value="drafts" className="px-3.5 text-[13px] transition-none xl:text-sm">
              Drafts <span className="text-foreground/55 numeric">{drafts.length}</span>
            </TabsTrigger>
            <TabsTrigger value="closed" className="px-3.5 text-[13px] transition-none xl:text-sm">
              Closed <span className="text-foreground/55 numeric">{closedAssignments.length}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button size="lg" onClick={onCreate}>
          <HugeiconsIcon icon={Add01Icon} size={15} strokeWidth={2} aria-hidden /> New homework
        </Button>
      </div>

      {/* Running generations and live attempts are the same question — what is
          happening right now — so they share one section. */}
      <InProgressHomework />

      {!hasVisibleHomework ? (
        <div className="panel">
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={ClipboardListIcon} size={20} strokeWidth={1.8} />
              </EmptyMedia>
              <EmptyTitle>
                {filter === "all" ? "No homework yet" : `No ${filter} homework`}
              </EmptyTitle>
              <EmptyDescription>
                {filter === "all"
                  ? "Build an assignment from a lesson brief, preview the exact student experience, then publish when it feels right."
                  : "Try another filter or create a new assignment."}
              </EmptyDescription>
            </EmptyHeader>
            {filter === "all" ? (
              <EmptyContent>
                <Button size="lg" onClick={onCreate}>
                  Create homework
                </Button>
              </EmptyContent>
            ) : null}
          </Empty>
        </div>
      ) : null}

      {visibleDrafts.length > 0 ? (
        <section className="grid gap-3">
          <SectionHeading title="Drafts" />
          <div className="panel divide-y divide-border/70 overflow-hidden">
            {visibleDrafts.map((draft) => (
              <article
                key={draft._id}
                className="group/row relative flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/35 xl:px-5"
              >
                {/* The row itself is the way in. The overlay carries the click so
                    the buttons beside it stay real buttons rather than nested
                    ones, which no browser allows. */}
                <button
                  type="button"
                  aria-label={`Open ${draft.title}`}
                  onClick={() => onOpenDraft(draft._id)}
                  className="absolute inset-0 z-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                />
                <HomeworkGlyph id={draft._id} />
                <div className="pointer-events-none min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium tracking-[-0.01em]">
                    {draft.title}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-muted-foreground numeric">
                    {describeDraftMeta(draft)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative z-10 shrink-0 opacity-0 transition-opacity duration-150 focus-visible:opacity-100 group-hover/row:opacity-100"
                  onClick={() => {
                    setDiscardError(null);
                    setDraftToDiscard(draft);
                  }}
                >
                  <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={2} aria-hidden />
                  <span className="sr-only sm:not-sr-only">Clear</span>
                </Button>
                <span className="relative z-0 shrink-0 text-[12.5px] font-medium text-primary">
                  Review
                </span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {visibleAssignments.length > 0 ? (
        <section className="grid gap-3">
          <SectionHeading title={filter === "closed" ? "Closed" : "Published"} />
          <div className="panel divide-y divide-border/70 overflow-hidden">
            {visibleAssignments.map((assignment) => {
              const shareUrl = buildShareUrl(assignment.shareToken);
              const isPublished = assignment.status === "published";
              return (
                <article
                  key={assignment._id}
                  className="group/row relative flex items-stretch gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/35 xl:px-5"
                >
                  <button
                    type="button"
                    aria-label={`Open ${assignment.title}`}
                    onClick={() => onOpenDraft(assignment.homeworkDraftId)}
                    className="absolute inset-0 z-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  />
                  <HomeworkGlyph id={assignment.homeworkDraftId} />
                  <div className="pointer-events-none min-w-0 flex-1 self-stretch">
                    <p className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[14px] font-medium tracking-[-0.01em]">
                        {assignment.title}
                      </span>
                      {isPublished ? null : (
                        <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                          Closed
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-muted-foreground numeric">
                      {describeAssignmentMeta(assignment)}
                    </p>
                  </div>

                  <div className="relative z-10 flex shrink-0 flex-col items-end justify-between gap-2">
                    <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover/row:opacity-100">
                      <Button
                        variant="ghost"
                        size="sm"
                        nativeButton={false}
                        render={<a href={shareUrl} target="_blank" rel="noopener noreferrer" />}
                      >
                        <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} strokeWidth={2} aria-hidden />
                        <span className="sr-only sm:not-sr-only">Student link</span>
                      </Button>
                      {isPublished ? (
                        <Button variant="ghost" size="sm" onClick={() => setAssignmentToClose(assignment)}>
                          Close
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void copyShareLink(assignment.shareToken, shareUrl)}
                      >
                        <HugeiconsIcon
                          icon={
                            copiedToken === assignment.shareToken ? CheckmarkCircle02Icon : Copy01Icon
                          }
                          size={13}
                          strokeWidth={2}
                          aria-hidden
                        />
                        {copiedToken === assignment.shareToken
                          ? "Copied"
                          : copyFailureToken === assignment.shareToken
                            ? "Retry"
                            : "Link"}
                      </Button>
                    </div>
                    <span className="pointer-events-none">
                      <AssignedStudentAvatars students={assignment.assignedStudents} />
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <AlertDialog
        open={assignmentToClose !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen && !isClosing) setAssignmentToClose(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close student access?</AlertDialogTitle>
            <AlertDialogDescription>
              The link for “{assignmentToClose?.title}” will stop working immediately. Existing
              submissions stay available.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClosing}>Keep open</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              disabled={isClosing}
              onClick={() => void closeSelectedAssignment()}
            >
              {isClosing ? "Closing…" : "Close access"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={draftToDiscard !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen && !isDiscarding) {
            setDraftToDiscard(null);
            setDiscardError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              “{draftToDiscard?.title}” and all of its generated activities will be permanently
              removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {discardError ? (
            <p role="alert" className="text-[12.5px] leading-5 text-destructive">
              {discardError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDiscarding}>Keep draft</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              disabled={isDiscarding}
              onClick={() => void discardSelectedDraft()}
            >
              {isDiscarding ? "Clearing…" : "Clear draft"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <p className="sr-only" aria-live="polite">{copyAnnouncement}</p>
    </div>
  );
}

function AssignedStudentAvatars({
  students,
}: {
  students: PublishedAssignment["assignedStudents"];
}) {
  if (students.length === 0) {
    return <span className="shrink-0 pb-1 text-[11px] text-muted-foreground">Unassigned</span>;
  }

  const visibleStudents = students.slice(0, 3);
  const hiddenStudentCount = students.length - visibleStudents.length;
  return (
    <AvatarGroup className="shrink-0 pb-0.5" aria-label={`Assigned to ${students.map((student) => student.name).join(", ")}`}>
      {visibleStudents.map((student) => (
        <Avatar key={student._id} size="sm" title={student.name}>
          <AvatarFallback className="bg-primary-soft text-[9px] font-semibold text-primary">
            {initials(student.name)}
          </AvatarFallback>
        </Avatar>
      ))}
      {hiddenStudentCount > 0 ? (
        <AvatarGroupCount className="text-[9px]">+{hiddenStudentCount}</AvatarGroupCount>
      ) : null}
    </AvatarGroup>
  );
}

/** One line, only what distinguishes this set from the others in the list. */
function describeDraftMeta(draft: HomeworkDraft) {
  return [
    `${draft.questionCount} activities`,
    `${draft.estimatedMinutes} min`,
    draft.studentName,
  ]
    .filter(Boolean)
    .join(" · ");
}

function describeAssignmentMeta(assignment: PublishedAssignment) {
  const inProgress = assignment.startedCount - assignment.submittedCount;
  return [
    assignment.studentName,
    `${assignment.submittedCount}/${assignment.startedCount || 0} submitted`,
    inProgress > 0 ? `${inProgress} in progress` : null,
    assignment.dueAt ? `due ${formatPublishedDate(assignment.dueAt)}` : null,
    assignment.averageRating === undefined ? null : `${assignment.averageRating}/5`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatPublishedDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(timestamp);
}

/** The library's own shape: filter tabs, the new-homework button, then rows. */
function LoadingState() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading homework"
      className="mx-auto grid max-w-[1480px] gap-8 px-6 py-8 lg:px-10 xl:gap-9 xl:py-10"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Skeleton className="h-9 w-[22rem] rounded-2xl" />
        <Skeleton className="h-10 w-40 rounded-2xl" />
      </div>
      <section className="grid gap-3">
        <Skeleton className="h-4 w-24" />
        <HomeworkRowsSkeleton rows={3} />
      </section>
      <section className="grid gap-3">
        <Skeleton className="h-4 w-28" />
        <HomeworkRowsSkeleton rows={4} />
      </section>
    </div>
  );
}

/** One row per homework: glyph, title, meta line, trailing action. */
function HomeworkRowsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="panel divide-y divide-border/70 overflow-hidden" aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3 xl:px-5">
          <Skeleton className="size-9 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3.5 w-[min(22rem,60%)]" />
            <Skeleton className="mt-2 h-2.5 w-40" />
          </div>
          <Skeleton className="h-7 w-20 rounded-2xl" />
        </div>
      ))}
    </div>
  );
}
