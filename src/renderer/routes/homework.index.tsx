import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PageHeader } from "@/app/workspace-shell";
import { HomeworkLibrary } from "@/homework/library/homework-library";

export const Route = createFileRoute("/homework/")({ component: HomeworkLibraryPage });

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
