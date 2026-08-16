import { createFileRoute, useNavigate } from "@tanstack/react-router";

import type { Id } from "@convex/_generated/dataModel";
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
    <HomeworkBuilder
        key={studentId ?? "general"}
        availability={availability}
        initialStudentId={(studentId as Id<"students"> | undefined) ?? null}
        // Opening the builder for a named student starts clean; the plain
        // "New homework" entry resumes whatever brief was last being written.
        startFresh={studentId !== undefined}
      // Generation runs above the pages now, so the builder hands off and the
      // library takes over: the run appears there, then the draft.
      onGenerationStarted={() => void navigate({ to: "/homework" })}
    />
  );
}
