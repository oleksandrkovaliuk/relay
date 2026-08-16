import {
  Add01Icon,
  AssignmentsIcon,
  Cancel01Icon,
  Edit01Icon,
  ExternalLinkIcon,
  UserGroup03Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useConvex, useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { useState, type ReactNode } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { prewarmStudentHistory } from "@/lib/convex-query-warmup";
import { formatRelativeTime, initials } from "@/lib/utils";

type StudentDraft = {
  name: string;
  email: string;
  miroBoardUrl: string;
  contextNotes: string;
};

type StudentSummary = NonNullable<ReturnType<typeof useQuery<typeof api.students.list>>>[number];

const EMPTY_DRAFT: StudentDraft = { name: "", email: "", miroBoardUrl: "", contextNotes: "" };
const HEADER_ADD_STUDENT_TRIGGER_ID = "add-student-header-trigger";
const EMPTY_ADD_STUDENT_TRIGGER_ID = "add-student-empty-trigger";
const MINIMUM_NAME_LENGTH = 2;

export function StudentsView({
  now,
  onCreateHomework,
  onOpenHistory,
}: {
  now: number;
  onCreateHomework: (studentId: Id<"students">) => void;
  onOpenHistory: (studentId: Id<"students">) => void;
}) {
  const convex = useConvex();
  const students = useQuery(api.students.list);
  const [editingId, setEditingId] = useState<Id<"students"> | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addStudentTriggerId, setAddStudentTriggerId] = useState<string | null>(null);

  return (
    <Dialog
      open={isAdding}
      triggerId={addStudentTriggerId}
      onOpenChange={(nextOpen, eventDetails) => {
        setIsAdding(nextOpen);
        if (nextOpen) setAddStudentTriggerId(eventDetails.trigger?.id ?? null);
      }}
    >
      <div className="mx-auto w-full max-w-[1480px] px-6 py-6 lg:px-10 xl:py-8">
        <section className="grid gap-3" aria-label="Student profiles">
          <div className="flex justify-end">
            <DialogTrigger
              id={HEADER_ADD_STUDENT_TRIGGER_ID}
              render={<Button size="lg" />}
            >
              <HugeiconsIcon icon={Add01Icon} size={15} strokeWidth={2} aria-hidden />
              Add student
            </DialogTrigger>
          </div>

          {students === undefined ? (
            <StudentCardsSkeleton />
          ) : students.length === 0 ? (
            <div className="panel">
              <Empty className="border-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HugeiconsIcon icon={UserGroup03Icon} size={20} strokeWidth={1.8} />
                  </EmptyMedia>
                  <EmptyTitle>No students yet</EmptyTitle>
                  <EmptyDescription>
                    Add a student with their level, recurring errors, and Miro board. New homework
                    will start from that context.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <DialogTrigger
                    id={EMPTY_ADD_STUDENT_TRIGGER_ID}
                    render={<Button size="lg" />}
                  >
                    <HugeiconsIcon icon={Add01Icon} size={15} strokeWidth={2} aria-hidden />
                    Add your first student
                  </DialogTrigger>
                </EmptyContent>
              </Empty>
            </div>
          ) : (
            /* One panel per student: a card that ends where the student does,
               instead of rows melting into one long sheet. */
            <div className="grid gap-3">
              {students.map((student) =>
                editingId === student._id ? (
                  <StudentEditForm
                    key={student._id}
                    title={`Edit ${student.name}`}
                    studentId={student._id}
                    initial={{
                      name: student.name,
                      email: student.email ?? "",
                      miroBoardUrl: student.miroBoardUrl ?? "",
                      contextNotes: student.contextNotes,
                    }}
                    onCancel={() => setEditingId(null)}
                    onSaved={() => setEditingId(null)}
                  />
                ) : (
                  <StudentCard
                    key={student._id}
                    student={student}
                    now={now}
                    onEdit={() => setEditingId(student._id)}
                    onPrewarmHistory={() => prewarmStudentHistory(convex, student._id)}
                    onOpenHistory={() => {
                      prewarmStudentHistory(convex, student._id);
                      onOpenHistory(student._id);
                    }}
                    onCreateHomework={() => onCreateHomework(student._id)}
                  />
                ),
              )}
            </div>
          )}
        </section>
      </div>

      <NewStudentDialogContent onSaved={() => setIsAdding(false)} />
    </Dialog>
  );
}

/** One panel per student, the way the real list is built — not one long sheet. */
function StudentCardsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading students" className="grid gap-3">
      {["first", "second", "third"].map((key) => (
        <div key={key} className="panel px-4 py-5 sm:px-5 xl:px-6 xl:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="min-w-0">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="mt-2 h-2.5 w-52" />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 lg:shrink-0 lg:justify-end">
              <Skeleton className="h-9 w-20 rounded-2xl" />
              <Skeleton className="h-9 w-24 rounded-2xl" />
              <Skeleton className="h-9 w-28 rounded-2xl" />
            </div>
          </div>
          <Skeleton className="mt-5 h-2.5 w-16" />
          <Skeleton className="mt-2.5 h-2.5 w-full max-w-2xl" />
          <div className="mt-5 flex flex-wrap gap-x-10 gap-y-3">
            {["assigned", "submitted", "average", "active"].map((statKey) => (
              <div key={statKey}>
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="mt-2 h-4 w-10" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <span className="sr-only">Loading students</span>
    </div>
  );
}

function StudentCard({
  student,
  now,
  onEdit,
  onPrewarmHistory,
  onOpenHistory,
  onCreateHomework,
}: {
  student: StudentSummary;
  now: number;
  onEdit: () => void;
  onPrewarmHistory: () => void;
  onOpenHistory: () => void;
  onCreateHomework: () => void;
}) {
  return (
    <article className="panel px-4 py-5 sm:px-5 xl:px-6 xl:py-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-[10.5px] font-semibold text-secondary-foreground ring-1 ring-foreground/8">
            {initials(student.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold tracking-[-0.015em] text-foreground xl:text-[16px]">
              {student.name}
            </p>
            {student.email ? (
              <p className="mt-0.5 truncate text-[12px] text-muted-foreground xl:text-[13px]">
                {student.email}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 lg:shrink-0 lg:justify-end">
          {student.miroBoardUrl ? (
            <Button
              variant="ghost"
              size="lg"
              nativeButton={false}
              render={
                <a href={student.miroBoardUrl} target="_blank" rel="noreferrer" />
              }
            >
              <HugeiconsIcon icon={ExternalLinkIcon} size={15} strokeWidth={2} aria-hidden />
              Miro
            </Button>
          ) : null}
          <Button variant="ghost" size="lg" onClick={onEdit}>
            <HugeiconsIcon icon={Edit01Icon} size={15} strokeWidth={2} aria-hidden />
            Edit
          </Button>
          <Button
            variant="outline"
            size="lg"
            onPointerEnter={onPrewarmHistory}
            onPointerDown={onPrewarmHistory}
            onFocus={onPrewarmHistory}
            onClick={onOpenHistory}
          >
            <HugeiconsIcon icon={ViewIcon} size={15} strokeWidth={2} aria-hidden />
            History
          </Button>
          <Button size="lg" onClick={onCreateHomework}>
            <HugeiconsIcon icon={AssignmentsIcon} size={15} strokeWidth={2} aria-hidden />
            Homework
          </Button>
        </div>
      </header>

      <div className="mt-5 max-w-6xl">
        <p className="text-[11.5px] font-semibold text-secondary-foreground xl:text-[12px]">
          Context
        </p>
        <p className="mt-1.5 text-pretty text-[13.5px] leading-6 text-secondary-foreground xl:text-[14px]">
          {student.contextNotes || "No context yet — add their level and recurring errors."}
        </p>
      </div>

      {/* Full width, so the rule reads as the card's own divider. */}
      <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-4 border-t border-border pt-4 sm:grid-cols-4">
        <StudentMetric label="Assigned" value={student.assignmentCount} />
        <StudentMetric label="Submitted" value={student.submittedCount} />
        <StudentMetric
          label="Average score"
          value={student.averageScore === undefined ? "—" : `${student.averageScore}%`}
        />
        <StudentMetric
          label="Last active"
          value={
            student.lastActivityAt ? formatRelativeTime(student.lastActivityAt, now) : "No activity"
          }
        />
      </dl>
    </article>
  );
}

function StudentMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col">
      <dt className="order-2 mt-0.5 text-[11.5px] text-muted-foreground xl:text-[12px]">{label}</dt>
      <dd className="order-1 text-[15px] font-semibold leading-5 text-foreground numeric xl:text-[16px]">
        {value}
      </dd>
    </div>
  );
}

function NewStudentDialogContent({ onSaved }: { onSaved: () => void }) {
  return (
    <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:max-w-[560px]">
      <DialogHeader className="relative gap-1 border-b border-border/70 px-5 py-4 pr-16 text-left sm:px-6 sm:py-5">
        <DialogTitle className="text-[17px] font-semibold tracking-[-0.02em]">
          Add student
        </DialogTitle>
        <DialogDescription className="max-w-md text-[13px] leading-5">
          Save the context you want available whenever you create their homework.
        </DialogDescription>
        <DialogClose
          render={
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label="Close add student dialog"
              className="absolute right-3 top-3"
            />
          }
        >
          <HugeiconsIcon icon={Cancel01Icon} size={15} strokeWidth={2} aria-hidden />
          <span className="sr-only">Close</span>
        </DialogClose>
      </DialogHeader>

      <StudentEditorForm className="p-5 sm:p-6" onCancel={onSaved} onSaved={onSaved} />
    </DialogContent>
  );
}

function StudentEditForm({
  title,
  studentId,
  initial = EMPTY_DRAFT,
  onCancel,
  onSaved,
}: {
  title: string;
  studentId: Id<"students">;
  initial?: StudentDraft;
  onCancel: () => void;
  onSaved: () => void;
}) {
  return (
    <div className="panel p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[16px] font-semibold tracking-[-0.01em] xl:text-[17px]">{title}</p>
        <Button variant="ghost" size="icon-lg" aria-label="Cancel editing" onClick={onCancel}>
          <HugeiconsIcon icon={Cancel01Icon} size={15} strokeWidth={2} aria-hidden />
        </Button>
      </div>
      <StudentEditorForm
        className="mt-5 max-w-3xl"
        studentId={studentId}
        initial={initial}
        onCancel={onCancel}
        onSaved={onSaved}
      />
    </div>
  );
}

function StudentEditorForm({
  studentId,
  initial = EMPTY_DRAFT,
  className,
  onCancel,
  onSaved,
}: {
  studentId?: Id<"students">;
  initial?: StudentDraft;
  className?: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const create = useMutation(api.students.create);
  const update = useMutation(api.students.update);
  const [draft, setDraft] = useState(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function field<Key extends keyof StudentDraft>(key: Key) {
    return (event: { target: { value: string } }) =>
      setDraft((current) => ({ ...current, [key]: event.target.value }));
  }

  async function save() {
    setIsSaving(true);
    setError(null);
    const payload = {
      name: draft.name.trim(),
      ...(draft.email.trim() ? { email: draft.email.trim() } : {}),
      ...(draft.miroBoardUrl.trim() ? { miroBoardUrl: draft.miroBoardUrl.trim() } : {}),
      contextNotes: draft.contextNotes,
    };
    try {
      if (studentId) await update({ studentId, ...payload });
      else await create(payload);
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the student.");
      setIsSaving(false);
    }
  }

  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <StudentFormField label="Name" htmlFor="student-name">
          <Input
            id="student-name"
            autoFocus
            required
            minLength={MINIMUM_NAME_LENGTH}
            autoComplete="name"
            value={draft.name}
            onChange={field("name")}
            placeholder="Mira Petrova"
          />
        </StudentFormField>
        <StudentFormField label="Email" htmlFor="student-email" hint="Optional">
          <Input
            id="student-email"
            type="email"
            autoComplete="email"
            value={draft.email}
            onChange={field("email")}
            placeholder="mira@example.com"
          />
        </StudentFormField>
      </div>

      <div className="mt-4">
        <StudentFormField
          label="Miro board"
          htmlFor="student-miro"
          hint="Created with the student and reused by every homework"
        >
          <Input
            id="student-miro"
            type="url"
            value={draft.miroBoardUrl}
            onChange={field("miroBoardUrl")}
            placeholder="https://miro.com/app/board/…"
          />
        </StudentFormField>
      </div>

      <div className="mt-4">
        <StudentFormField
          label="Context"
          htmlFor="student-context"
          hint="Level, goals, and recurring errors used for new homework"
        >
          <Textarea
            id="student-context"
            className="min-h-24 text-[13.5px]"
            rows={3}
            value={draft.contextNotes}
            onChange={field("contextNotes")}
            placeholder="B1 learner preparing for a work trip. Drops articles before singular nouns, confuses past simple with past perfect. Motivated by travel topics."
          />
        </StudentFormField>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-[13px] text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="lg"
          disabled={draft.name.trim().length < MINIMUM_NAME_LENGTH || isSaving}
        >
          {isSaving ? "Saving…" : studentId ? "Save changes" : "Add student"}
        </Button>
      </div>
    </form>
  );
}

function StudentFormField({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {children}
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  );
}
