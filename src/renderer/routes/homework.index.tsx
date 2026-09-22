import { convexQuery } from "@convex-dev/react-query";

import { api } from "@convex/_generated/api";
import { preload } from "@/lib/route-preload";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PageHeader } from "@/app/workspace-shell";
import { HomeworkLibrary } from "@/homework/library/homework-library";

export const Route = createFileRoute("/homework/")({
  /** The list is in the cache before the page renders, so the tab opens on content. */
  loader: async ({ context }) => {
    await preload(
      context.queryClient,
      convexQuery(api.assignments.listPublished, {}),
      convexQuery(api.assignments.listDrafts, {}),
    );
  },
  component: HomeworkLibraryPage,
});

function HomeworkLibraryPage() {
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        action={<Button size="lg" onClick={() => void navigate({ to: "/homework/new" })}><Plus size={15} aria-hidden /> New homework</Button>}
        title="Homework"
        description="Review drafts, preview assignments, and manage published links."
      />
      <HomeworkLibrary
        onCreate={() => void navigate({ to: "/homework/new" })}
        onOpenDraft={(homeworkDraftId) =>
          void navigate({
            to: "/homework/drafts/$homeworkDraftId",
            params: { homeworkDraftId },
          })
        }
      />
    </>
  );
}
