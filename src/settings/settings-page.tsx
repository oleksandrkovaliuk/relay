import type { ReactNode } from "react";

import { ClaudeAccountsSection } from "@/claude/claude-accounts-section";
import { CLAUDE_INSTALL_GUIDE_URL } from "@/claude/claude-setup-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { ClaudeAvailability } from "@/shared/claude";
import { AppearanceSection } from "./appearance-section";

export function SettingsPage({
  availability,
  onRecheck,
}: {
  availability: ClaudeAvailability | null;
  onRecheck: () => void;
}) {
  return (
    <div className="mx-auto grid w-full max-w-[46rem] gap-8 px-6 pb-16 pt-6 lg:px-8">
      <SettingsSection
        title="Appearance"
        description="Applies to this Mac only."
      >
        <AppearanceSection />
      </SettingsSection>

      <SettingsSection
        title="Claude accounts"
        description="Homework generation and answer summaries run through the Claude Code CLI on this Mac."
        action={
          <Button variant="ghost" size="sm" onClick={onRecheck}>
            Re-check
          </Button>
        }
      >
        <ClaudeRuntimeStatus availability={availability} />
        <ClaudeAccountsSection />
      </SettingsSection>

    </div>
  );
}

function SettingsSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1">
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold tracking-[-0.02em]">{title}</h2>
          <p className="mt-1 text-pretty text-[13px] leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function ClaudeRuntimeStatus({ availability }: { availability: ClaudeAvailability | null }) {
  if (availability === null) {
    return (
      <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Spinner className="size-3.5" /> Checking the local Claude runtime…
      </p>
    );
  }

  if (!availability.isInstalled) {
    return (
      <div className="grid gap-2 rounded-xl border border-amber-500/25 bg-amber-500/8 px-3.5 py-3">
        <p className="text-pretty text-[13px] leading-5 text-secondary-foreground">
          {availability.problem ?? "Claude Code is not installed on this Mac."}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="justify-self-start"
          nativeButton={false}
          render={
            <a href={CLAUDE_INSTALL_GUIDE_URL} target="_blank" rel="noopener noreferrer" />
          }
        >
          Installation guide
        </Button>
      </div>
    );
  }

  return (
    <p className={cn("text-[12.5px] leading-5", "text-muted-foreground")}>
      Claude Code {availability.version ?? "detected"} · this check never identifies the teacher
      using Relay.
    </p>
  );
}
