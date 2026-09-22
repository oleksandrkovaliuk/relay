import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";

import { useQuery } from "@/lib/convex-query";

import { api } from "@convex/_generated/api";
import { preload } from "@/lib/route-preload";
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
  remountDeps: ({ params }) => params,
  /**
   * Both queries the page opens on are fetched before it renders, so navigation lands on
   * the student's homework rather than on a skeleton that resolves a moment later.
   */
  loader: async ({ context, params }) => {
    const studentId = params.studentId as Id<"students">;
    await preload(
      context.queryClient,
      convexQuery(api.students.get, { studentId }),
      convexQuery(api.students.history, { studentId }),
    );
  },
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
        title={student?.name ? `${student.name}'s homework` : "Homework review"}
        description="Every answer as the student left it, marked where Relay could mark it."
      />
      <SubmissionReview
        key={studentId}
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
