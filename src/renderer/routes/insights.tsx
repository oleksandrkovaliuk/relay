import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/app/workspace-shell";
import { InsightsView } from "@/insights/insights-view";
import { useNow } from "@/lib/use-now";

export const Route = createFileRoute("/insights")({ component: InsightsPage });

function InsightsPage() {
  const now = useNow();

  return (
    <>
      <PageHeader
        title="Insights"
        description="Patterns across submissions, without the dashboard noise."
      />
      <InsightsView now={now} />
    </>
  );
}
