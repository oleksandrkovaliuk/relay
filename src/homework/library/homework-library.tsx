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
import { ListSkeleton } from "@/components/list-skeleton";
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
import { GeneratingHomework } from "./generating-homework";

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

      <GeneratingHomework />

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
                className="group/row flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/35 xl:px-5"
              >
                <HomeworkGlyph id={draft._id} />
                <button
                  type="button"
                  onClick={() => onOpenDraft(draft._id)}
                  className="min-w-0 flex-1 text-left outline-none focus-visible:underline"
                >
                  <span className="block truncate text-[14px] font-medium tracking-[-0.01em]">
                    {draft.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-muted-foreground numeric">
                    {describeDraftMeta(draft)}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 opacity-0 transition-opacity duration-150 focus-visible:opacity-100 group-hover/row:opacity-100"
                  onClick={() => {
                    setDiscardError(null);
                    setDraftToDiscard(draft);
                  }}
                >
                  <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={2} aria-hidden />
                  <span className="sr-only sm:not-sr-only">Clear</span>
                </Button>
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => onOpenDraft(draft._id)}>
                  Review
                </Button>
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
                  className="group/row flex items-stretch gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/35 xl:px-5"
                >
                  <HomeworkGlyph id={assignment.homeworkDraftId} />
                  <div className="min-w-0 flex-1 self-stretch">
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

                  <div className="flex shrink-0 flex-col items-end justify-between gap-2">
                    <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover/row:opacity-100">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenDraft(assignment.homeworkDraftId)}
                      >
                        Preview & edit
                      </Button>
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
                    <AssignedStudentAvatars students={assignment.assignedStudents} />
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

function LoadingState() {
  return (
    <div className="mx-auto grid max-w-[1480px] gap-8 px-6 py-8 lg:px-10 xl:py-10">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-72 rounded-2xl" />
        <Skeleton className="h-9 w-36 rounded-2xl" />
      </div>
      <ListSkeleton rows={3} label="Loading homework" />
    </div>
  );
}
