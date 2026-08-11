import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/homework")({ component: HomeworkSection });

function HomeworkSection() {
  return <Outlet />;
}
