import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";

import { useQuery } from "@/lib/convex-query";

import { api } from "@convex/_generated/api";
import { preload } from "@/lib/route-preload";
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
  remountDeps: ({ params }) => params,
  /**
   * The submission is fetched before the page renders. Its student's other sets cannot be
   * fetched here — the student is only known once the submission arrives — so the sidebar
   * is the one part that still fills in after paint.
   */
  loader: async ({ context, params }) => {
    await preload(
      context.queryClient,
      convexQuery(api.submissions.detail, { submissionId: params.submissionId as Id<"submissions"> }),
    );
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
        title={detail?.studentName ? `${detail.studentName}'s homework` : "Homework review"}
        description="Every answer as the student left it, marked where Relay could mark it."
      />
      <SubmissionReview
        key={submissionId}
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
