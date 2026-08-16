import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PageHeader } from "@/app/workspace-shell";
import { useNow } from "@/lib/use-now";
import { SubmissionReview } from "@/submissions/submission-review";

type SubmissionSearch = { step?: number };

export const Route = createFileRoute("/submissions/$submissionId")({
  /** `?step=4` opens the review on the activity the student stopped at. */
  validateSearch: (search: Record<string, unknown>): SubmissionSearch => {
    const step = Number(search.step);
    return Number.isInteger(step) && step > 0 ? { step } : {};
  },
  component: SubmissionReviewRoute,
});

/**
 * Review reached from a piece of work rather than from a student — the way Today
 * and Insights hand one over. Not every submission belongs to a saved student,
 * so the student is resolved from the submission instead of the other way round.
 */
function SubmissionReviewRoute() {
  const { submissionId } = Route.useParams();
  const { step } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const now = useNow();
  const detail = useQuery(api.submissions.detail, {
    submissionId: submissionId as Id<"submissions">,
  });

  return (
    <>
      <PageHeader
        title={detail ? `${detail.studentName}'s homework` : "Homework review"}
        description="Every answer as the student left it, with your grade where one is needed."
      />
      <SubmissionReview
        studentId={null}
        submissionId={submissionId as Id<"submissions">}
        focusStep={step ?? null}
        now={now}
        backLabel="Back"
        /* Back to wherever the review was opened from — Today, or Insights. */
        onBack={() => router.history.back()}
        onSelectSubmission={(nextSubmissionId) =>
          void navigate({
            to: "/submissions/$submissionId",
            params: { submissionId: nextSubmissionId },
          })
        }
      />
    </>
  );
}
