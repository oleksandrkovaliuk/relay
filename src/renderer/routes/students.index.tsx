import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { PageHeader } from "@/app/workspace-shell";
import { useNow } from "@/lib/use-now";
import { StudentsView } from "@/students/students-view";

export const Route = createFileRoute("/students/")({ component: StudentsPage });

function StudentsPage() {
  const navigate = useNavigate();
  const now = useNow();

  return (
    <>
      <PageHeader
        title="Students"
        description="Context, progress, and a clear next action for every learner."
      />
      <StudentsView
        now={now}
        onCreateHomework={(studentId) =>
          void navigate({ to: "/homework/new", search: { studentId } })
        }
        onOpenHistory={(studentId) =>
          void navigate({ to: "/students/$studentId/history", params: { studentId } })
        }
      />
    </>
  );
}
