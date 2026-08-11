import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { PageHeader } from "@/app/workspace-shell";
import {
  parseInsightsSearch,
  type InsightsSearch,
} from "@/insights/insight-filter";
import { InsightsView } from "@/insights/insights-view";
import { useNow } from "@/lib/use-now";

export const Route = createFileRoute("/insights")({
  component: InsightsPage,
  validateSearch: parseInsightsSearch,
});

function InsightsPage() {
  const now = useNow();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <>
      <PageHeader
        title="Insights"
        description="What the submitted work says, for whichever student and period you pick."
      />
      <InsightsView
        now={now}
        search={search}
        onSearchChange={(next: InsightsSearch) =>
          void navigate({ search: next, replace: true })
        }
      />
    </>
  );
}
