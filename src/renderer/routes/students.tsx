import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/students")({ component: StudentsSection });

function StudentsSection() {
  return <Outlet />;
}
