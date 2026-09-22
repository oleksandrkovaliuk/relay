import { convexQuery } from "@convex-dev/react-query";

import { api } from "@convex/_generated/api";
import { preload } from "@/lib/route-preload";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useNow } from "@/lib/use-now";
import { StudentsView } from "@/students/students-view";

export const Route = createFileRoute("/students/")({
  /** The list is in the cache before the page renders, so the tab opens on content. */
  loader: ({ context }) =>
    preload(context.queryClient, convexQuery(api.students.list, {})),
  component: StudentsPage,
});

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
