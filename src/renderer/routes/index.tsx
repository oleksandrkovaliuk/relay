import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/app/workspace-shell";
import { useNow } from "@/lib/use-now";
import { TodayFeed } from "@/today/today-feed";

export const Route = createFileRoute("/")({ component: TodayPage });

function TodayPage() {
  const now = useNow();

  return (
    <>
      <PageHeader
        title={formatTeachingDay(now)}
        description="Student progress and the next useful teaching action."
      />
      <TodayFeed now={now} />
    </>
  );
}

function formatTeachingDay(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(timestamp);
}
