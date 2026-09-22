import { convexQuery } from "@convex-dev/react-query";

import { api } from "@convex/_generated/api";
import { preload } from "@/lib/route-preload";
import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PageHeader } from "@/app/workspace-shell";
import { useNow } from "@/lib/use-now";
import { TodayFeed } from "@/today/today-feed";

export const Route = createFileRoute("/")({
  /** The list is in the cache before the page renders, so the tab opens on content. */
  loader: ({ context }) => preload(context.queryClient, convexQuery(api.feed.inbox, {})),
  component: TodayPage,
});

function TodayPage() {
  const now = useNow();

  return (
    <>
      <PageHeader
        title={formatTeachingDay(now)}
        description="Student progress and recent submissions."
        action={<Button size="lg" nativeButton={false} render={<Link to="/homework/new" />}><Plus size={15} aria-hidden /> New homework</Button>}
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
