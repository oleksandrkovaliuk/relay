import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PageHeader } from "@/app/workspace-shell";
import { useNow } from "@/lib/use-now";
import { StudentHistoryPage } from "@/students/history/student-history-page";

export const Route = createFileRoute("/students/$studentId/history")({
  component: StudentHistoryRoute,
});

function StudentHistoryRoute() {
  const { studentId } = Route.useParams();
  const navigate = useNavigate();
  const now = useNow();
  const student = useQuery(api.students.get, { studentId: studentId as Id<"students"> });

  return (
    <>
      <PageHeader
        title={student ? `${student.name}'s lessons` : "Lesson history"}
        description="Every submitted step, in the order the student worked through it."
      />
      <StudentHistoryPage
        studentId={studentId as Id<"students">}
        now={now}
        onBack={() => void navigate({ to: "/students" })}
      />
    </>
  );
}
