import { createFileRoute, useNavigate } from "@tanstack/react-router";

import type { Id } from "@convex/_generated/dataModel";
import { DraftReview } from "@/homework/review/draft-review";

export const Route = createFileRoute("/homework/drafts/$homeworkDraftId")({
  component: DraftReviewRoute,
});

function DraftReviewRoute() {
  const { homeworkDraftId } = Route.useParams();
  const navigate = useNavigate();
  const returnToLibrary = () => void navigate({ to: "/homework" });

  return (
    <DraftReview
      homeworkDraftId={homeworkDraftId as Id<"homeworkDrafts">}
      onDiscarded={returnToLibrary}
      onPublished={returnToLibrary}
    />
  );
}
