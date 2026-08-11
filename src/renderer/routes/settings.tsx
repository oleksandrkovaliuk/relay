import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/app/workspace-shell";
import { useSharedClaudeAvailability } from "@/claude/claude-availability-context";
import { SettingsPage } from "@/settings/settings-page";

export const Route = createFileRoute("/settings")({ component: SettingsRoute });

function SettingsRoute() {
  const { availability, refresh } = useSharedClaudeAvailability();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Appearance and the Claude accounts this workspace generates with."
      />
      <SettingsPage availability={availability} onRecheck={() => void refresh()} />
    </>
  );
}
