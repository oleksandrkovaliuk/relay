import { createFileRoute, useNavigate } from "@tanstack/react-router";

import type { Id } from "@convex/_generated/dataModel";
import { PageHeader } from "@/app/workspace-shell";
import { DraftReview } from "@/homework/review/draft-review";

export const Route = createFileRoute("/homework/drafts/$homeworkDraftId")({
  component: DraftReviewRoute,
});

function DraftReviewRoute() {
  const { homeworkDraftId } = Route.useParams();
  const navigate = useNavigate();
  const returnToLibrary = () => void navigate({ to: "/homework" });

  return (
    <>
      <PageHeader
        title="Review draft"
        description="Check every prompt and answer key, then publish when it feels right."
      />
      <DraftReview
        homeworkDraftId={homeworkDraftId as Id<"homeworkDrafts">}
        onDiscarded={returnToLibrary}
        onPublished={returnToLibrary}
      />
    </>
  );
}
