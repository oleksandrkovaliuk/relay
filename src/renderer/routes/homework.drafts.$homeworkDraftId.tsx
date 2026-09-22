import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { api } from "@convex/_generated/api";
import { preload } from "@/lib/route-preload";

import type { Id } from "@convex/_generated/dataModel";
import { DraftReview } from "@/homework/review/draft-review";

export const Route = createFileRoute("/homework/drafts/$homeworkDraftId")({
  remountDeps: ({ params }) => params,
  loader: async ({ context, params }) => {
    await preload(
      context.queryClient,
      convexQuery(api.assignments.getDraft, {
        homeworkDraftId: params.homeworkDraftId as Id<"homeworkDrafts">,
      }),
    );
  },
  component: DraftReviewRoute,
});

function DraftReviewRoute() {
  const { homeworkDraftId } = Route.useParams();
  const navigate = useNavigate();
  const returnToLibrary = () => void navigate({ to: "/homework" });

  return (
    <DraftReview
        key={homeworkDraftId}
      homeworkDraftId={homeworkDraftId as Id<"homeworkDrafts">}
      onDiscarded={returnToLibrary}
      onPublished={returnToLibrary}
    />
  );
}
