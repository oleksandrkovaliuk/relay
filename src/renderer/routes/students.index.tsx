import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useNow } from "@/lib/use-now";
import { StudentsView } from "@/students/students-view";

export const Route = createFileRoute("/students/")({ component: StudentsPage });

function StudentsPage() {
  const navigate = useNavigate();
  const now = useNow();

  return (
    <>
      <StudentsView
        now={now}
        onCreateHomework={(studentId) =>
          void navigate({ to: "/homework/new", search: { studentId } })
        }
        onOpenHistory={(studentId) =>
          void navigate({ to: "/students/$studentId/history", params: { studentId }, search: {} })
        }
      />
    </>
  );
}
