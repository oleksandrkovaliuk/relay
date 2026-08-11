import { createFileRoute, useNavigate } from "@tanstack/react-router";

import type { Id } from "@convex/_generated/dataModel";
import { PageHeader } from "@/app/workspace-shell";
import { useSharedClaudeAvailability } from "@/claude/claude-availability-context";
import { HomeworkBuilder } from "@/homework/builder/homework-builder";

type NewHomeworkSearch = { studentId?: string };

export const Route = createFileRoute("/homework/new")({
  component: NewHomeworkPage,
  validateSearch: (search: Record<string, unknown>): NewHomeworkSearch =>
    typeof search.studentId === "string" ? { studentId: search.studentId } : {},
});

function NewHomeworkPage() {
  const { studentId } = Route.useSearch();
  const navigate = useNavigate();
  const { availability } = useSharedClaudeAvailability();

  return (
    <>
      <PageHeader
        title="Build homework"
        description="Shape the brief and preview the student experience as you go."
      />
      <HomeworkBuilder
        key={studentId ?? "general"}
        availability={availability}
        initialStudentId={(studentId as Id<"students"> | undefined) ?? null}
        // Opening the builder for a named student starts clean; the plain
        // "New homework" entry resumes whatever brief was last being written.
        startFresh={studentId !== undefined}
        onPublished={() => void navigate({ to: "/homework" })}
      />
    </>
  );
}
