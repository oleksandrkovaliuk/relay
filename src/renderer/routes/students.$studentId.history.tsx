import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PageHeader } from "@/app/workspace-shell";
import { useNow } from "@/lib/use-now";
import { SubmissionReview } from "@/submissions/submission-review";

type HistorySearch = { submission?: Id<"submissions"> };

export const Route = createFileRoute("/students/$studentId/history")({
  /** Which set is open lives in the URL, so a link can point at one. */
  validateSearch: (search: Record<string, unknown>): HistorySearch =>
    typeof search.submission === "string"
      ? { submission: search.submission as Id<"submissions"> }
      : {},
  component: StudentHistoryRoute,
});

function StudentHistoryRoute() {
  const { studentId } = Route.useParams();
  const { submission } = Route.useSearch();
  const navigate = useNavigate();
  const now = useNow();
  const student = useQuery(api.students.get, { studentId: studentId as Id<"students"> });

  return (
    <>
      <PageHeader
        title={student ? `${student.name}'s homework` : "Homework review"}
        description="Every answer as the student left it, with your grade where one is needed."
      />
      <SubmissionReview
        studentId={studentId as Id<"students">}
        submissionId={submission ?? null}
        focusStep={null}
        now={now}
        backLabel="Students"
        onBack={() => void navigate({ to: "/students" })}
        onSelectSubmission={(submissionId) =>
          void navigate({
            to: "/students/$studentId/history",
            params: { studentId },
            search: { submission: submissionId },
          })
        }
      />
    </>
  );
}
