import { useUser } from "@clerk/react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache";
import { useEffect, useState } from "react";

import { api } from "@convex/_generated/api";
import {
  ClaudeAvailabilityProvider,
  useSharedClaudeAvailability,
} from "@/claude/claude-availability-context";
import { ClaudeSetupDialog } from "@/claude/claude-setup-dialog";
import { GenerationRunsProvider } from "@/claude/generation-runs";
import { useAutomaticSummaries } from "@/claude/use-automatic-summaries";
import { rememberLastRoute } from "@/lib/last-route";
import { WorkspaceShell } from "./workspace-shell";

const CLAUDE_ONBOARDING_STORAGE_KEY = "erm:claude-onboarding-complete:v1";

/**
 * Owns everything the whole workspace shares: the local Claude capability
 * check, its setup dialog, and the chrome every page renders inside.
 */
export function WorkspaceLayout() {
  return (
    <ClaudeAvailabilityProvider>
      {/* Above the pages on purpose: a generation must keep reporting after the
          teacher leaves the builder it was started from. */}
      <GenerationRunsProvider>
        <WorkspaceChrome />
      </GenerationRunsProvider>
    </ClaudeAvailabilityProvider>
  );
}

function WorkspaceChrome() {
  const { availability, refresh } = useSharedClaudeAvailability();
  const [claudeSetup, setClaudeSetup] = useState(readClaudeSetupState);
  const { user } = useUser();
  // Summaries are generated the moment work arrives, so the teacher never waits
  // for one they are already looking at.
  useAutomaticSummaries({ isClaudeReady: availability?.isAuthenticated ?? false });
  const awaitingSummary = useQuery(api.feed.awaitingSummary);
  const drafts = useQuery(api.assignments.listDrafts);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(function rememberWhereTheTeacherWas() {
    rememberLastRoute(pathname);
  }, [pathname]);

  function completeClaudeOnboarding() {
    try {
      window.localStorage.setItem(CLAUDE_ONBOARDING_STORAGE_KEY, "true");
    } catch {
      // Onboarding should still close when browser storage is unavailable.
    }
    setClaudeSetup({ hasCompletedOnboarding: true, isOpen: false });
  }

  return (
    <>
      <WorkspaceShell
        availability={availability}
        /* Who the workspace belongs to. The Claude login is not that: it is a
           tool this teacher happens to run, and the rail reports it as status. */
        teacher={
          user
            ? {
                name: user.fullName,
                email: user.primaryEmailAddress?.emailAddress ?? null,
                imageUrl: user.imageUrl,
              }
            : null
        }
        awaitingSummaryCount={awaitingSummary?.length ?? 0}
        draftsReadyCount={drafts?.length ?? 0}
        contentKey={pathname}
      >
        <Outlet />
      </WorkspaceShell>

      <ClaudeSetupDialog
        availability={availability}
        isFirstRun={!claudeSetup.hasCompletedOnboarding}
        isOpen={claudeSetup.isOpen}
        onContinue={completeClaudeOnboarding}
        onOpenChange={(isOpen) => setClaudeSetup((current) => ({ ...current, isOpen }))}
        onRetry={() => void refresh()}
      />
    </>
  );
}

function readClaudeSetupState() {
  const hasCompletedOnboarding = readOnboardingFlag();
  return { hasCompletedOnboarding, isOpen: !hasCompletedOnboarding };
}

function readOnboardingFlag() {
  try {
    return window.localStorage.getItem(CLAUDE_ONBOARDING_STORAGE_KEY) === "true";
  } catch {
    return true;
  }
}
