import { useMutation, useQuery } from "convex/react";
import {
  Add01Icon,
  ArrowUpRight01Icon,
  CheckmarkCircle02Icon,
  ClipboardListIcon,
  Copy01Icon,
  Delete02Icon,
  StarIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ListSkeleton } from "@/components/list-skeleton";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn, initials } from "@/lib/utils";
import { buildShareUrl } from "@/lib/share-links";
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

  if (assignments === undefined || drafts === undefined) return <LoadingState />;

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
          <HugeiconsIcon icon={Add01Icon} size={15} strokeWidth={2} /> New homework
        </Button>
      </div>

      <GeneratingHomework />

      {!hasVisibleHomework ? (
        <div className="panel">
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={ClipboardListIcon} size={19} strokeWidth={1.8} />
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
          <SectionHeading title="Ready for review" />
          <div className="panel divide-y divide-border/70 overflow-hidden">
            {visibleDrafts.map((draft) => (
              <article
                key={draft._id}
                className="grid gap-4 px-5 py-5 xl:px-6 xl:py-6"
              >
                <div className="flex min-w-0 items-start justify-between gap-4">
                  <StatusLabel tone="draft" label="Draft" />
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onOpenDraft(draft._id)}>
                      Review & preview
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        setDiscardError(null);
                        setDraftToDiscard(draft);
                      }}
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={13} strokeWidth={1.9} />
                      Clear draft
                    </Button>
                  </div>
                </div>
                <div className="min-w-0 max-w-5xl">
                  <h3 className="text-balance text-[15px] font-semibold leading-5 tracking-[-0.015em] xl:text-base">
                    {draft.title}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-pretty text-[13px] leading-5 text-foreground/72 xl:text-sm xl:leading-6">
                    {draft.summary}
                  </p>
                </div>
                <div className="flex min-w-0 items-end justify-between gap-4">
                  <p className="text-[12px] text-foreground/62 numeric xl:text-[13px]">
                    {draft.questionCount} activities · {draft.estimatedMinutes} min
                  </p>
                  <StudentAttribution name={draft.studentName} />
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {visibleAssignments.length > 0 ? (
        <section className="grid gap-3">
          <SectionHeading
            title={filter === "all" ? "Assignments" : filter === "closed" ? "Closed" : "Published"}
          />
          <div className="panel divide-y divide-border/70 overflow-hidden">
            {visibleAssignments.map((assignment) => {
              const shareUrl = buildShareUrl(assignment.shareToken);
              const isPublished = assignment.status === "published";
              return (
                <article
                  key={assignment._id}
                  className="grid gap-4 px-5 py-5 xl:px-6 xl:py-6"
                >
                  <div className="flex min-w-0 items-start justify-between gap-4">
                    <StatusLabel
                      tone={isPublished ? "published" : "closed"}
                      label={isPublished ? "Published" : "Closed"}
                    />
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        nativeButton={false}
                        render={
                          <a href={shareUrl} target="_blank" rel="noopener noreferrer" />
                        }
                      >
                        <HugeiconsIcon icon={ArrowUpRight01Icon} size={13} strokeWidth={1.9} />
                        Preview
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void copyShareLink(assignment.shareToken, shareUrl)}
                      >
                        <HugeiconsIcon
                          icon={copiedToken === assignment.shareToken ? CheckmarkCircle02Icon : Copy01Icon}
                          size={13}
                          strokeWidth={1.9}
                        />
                        {copiedToken === assignment.shareToken
                          ? "Copied"
                          : copyFailureToken === assignment.shareToken
                            ? "Try copy again"
                            : "Copy link"}
                      </Button>
                      {isPublished ? (
                        <Button variant="ghost" size="sm" onClick={() => setAssignmentToClose(assignment)}>
                          Close access
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="min-w-0 max-w-5xl">
                    <h3 className="text-balance text-[15px] font-semibold leading-5 tracking-[-0.015em] xl:text-base">
                      {assignment.title}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-pretty text-[13px] leading-5 text-foreground/72 xl:text-sm xl:leading-6">
                      {assignment.summary}
                    </p>
                    {assignment.latestFeedback?.comment ? (
                      <p className="mt-2 line-clamp-1 text-pretty text-[12px] leading-5 text-foreground/58 xl:text-[13px]">
                        <span className="font-medium text-foreground/72">
                          Latest from {assignment.latestFeedback.studentName}: 
                        </span>
                        “{assignment.latestFeedback.comment}”
                      </p>
                    ) : null}
                  </div>

                  <div className="flex min-w-0 items-end justify-between gap-4">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-foreground/62 numeric xl:text-[13px]">
                      <span>
                        {assignment.questionCount} activities · {assignment.submittedCount} submitted
                        {assignment.startedCount > assignment.submittedCount
                          ? ` · ${assignment.startedCount - assignment.submittedCount} in progress`
                          : ""}
                        {` · ${formatPublishedDate(assignment.publishedAt)}`}
                        {assignment.dueAt ? ` · due ${formatPublishedDate(assignment.dueAt)}` : ""}
                      </span>
                      {assignment.averageRating !== undefined ? (
                        <span
                          className="inline-flex items-center gap-1 font-medium text-foreground/72"
                          aria-label={`${assignment.averageRating} out of 5 from ${assignment.feedbackCount} student ${assignment.feedbackCount === 1 ? "rating" : "ratings"}`}
                        >
                          <HugeiconsIcon icon={StarIcon} size={13} strokeWidth={1.9} className="text-amber-600" />
                          {assignment.averageRating}/5 · {assignment.feedbackCount} {assignment.feedbackCount === 1 ? "rating" : "ratings"}
                        </span>
                      ) : null}
                    </div>
                    <StudentAttribution name={assignment.studentName} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <Dialog
        open={assignmentToClose !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen && !isClosing) setAssignmentToClose(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close student access?</DialogTitle>
            <DialogDescription>
              The link for “{assignmentToClose?.title}” will stop working immediately. Existing submissions stay available.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={isClosing} onClick={() => setAssignmentToClose(null)}>
              Keep open
            </Button>
            <Button variant="danger" disabled={isClosing} onClick={() => void closeSelectedAssignment()}>
              {isClosing ? "Closing…" : "Close access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={draftToDiscard !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen && !isDiscarding) {
            setDraftToDiscard(null);
            setDiscardError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear this draft?</DialogTitle>
            <DialogDescription>
              “{draftToDiscard?.title}” and all of its generated activities will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          {discardError ? (
            <p role="alert" className="text-[12.5px] leading-5 text-destructive">
              {discardError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={isDiscarding}
              onClick={() => {
                setDraftToDiscard(null);
                setDiscardError(null);
              }}
            >
              Keep draft
            </Button>
            <Button variant="danger" disabled={isDiscarding} onClick={() => void discardSelectedDraft()}>
              {isDiscarding ? "Clearing…" : "Clear draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <p className="sr-only" aria-live="polite">{copyAnnouncement}</p>
    </div>
  );
}

function StatusLabel({
  tone,
  label,
}: {
  tone: "draft" | "published" | "closed";
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-[12px] font-semibold xl:text-[13px]",
        tone === "published" && "text-emerald-700",
        tone === "draft" && "text-amber-700",
        tone === "closed" && "text-foreground/58",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full shadow-[0_0_0_3px_oklch(0_0_0/.035)]",
          tone === "published" && "bg-emerald-600",
          tone === "draft" && "bg-amber-500",
          tone === "closed" && "bg-muted-foreground/40",
        )}
      />
      {label}
    </span>
  );
}

function StudentAttribution({ name }: { name?: string | null }) {
  if (!name) return null;
  return (
    <span className="flex min-w-0 shrink-0 items-center gap-2 text-[12px] font-medium text-foreground/68 xl:text-[13px]">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[9.5px] font-semibold text-foreground/72">
        {initials(name)}
      </span>
      <span className="max-w-44 truncate">{name}</span>
    </span>
  );
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
