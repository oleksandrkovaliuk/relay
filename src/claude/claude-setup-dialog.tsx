import {
  CheckmarkCircle02Icon,
  CircleIcon,
  LinkSquare02Icon,
  Loading03Icon,
  ReloadIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ClaudeAvailability } from "@/shared/claude";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const CLAUDE_INSTALL_GUIDE_URL =
  "https://docs.anthropic.com/en/docs/claude-code/getting-started";

const CONTROL_FEEDBACK =
  "transition-[background-color,color,transform] duration-150 active:scale-[.96] motion-reduce:active:scale-100";

export function ClaudeSetupDialog({
  availability,
  isFirstRun,
  isOpen,
  onContinue,
  onOpenChange,
  onRetry,
}: {
  availability: ClaudeAvailability | null;
  isFirstRun: boolean;
  isOpen: boolean;
  onContinue: () => void;
  onOpenChange: (isOpen: boolean) => void;
  onRetry: () => void;
}) {
  const isChecking = availability === null;
  const isInstalled = availability?.isInstalled ?? false;
  const isAuthenticated = availability?.isAuthenticated ?? false;
  const isReady = isInstalled && isAuthenticated;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextIsOpen) => {
        // Dismissing on the very first run means the same thing as "continue
        // without Claude", so it must never trap the teacher in the dialog.
        if (!nextIsOpen && isFirstRun) {
          onContinue();
          return;
        }
        onOpenChange(nextIsOpen);
      }}
    >
      <DialogContent className="gap-4 rounded-2xl p-5 sm:max-w-[460px]">
        <DialogHeader className="gap-2 pr-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Local capability
          </p>
          <DialogTitle className="text-balance text-[21px] font-semibold leading-7 tracking-[-0.03em]">
            {getDialogTitle({ isFirstRun, isReady, isInstalled })}
          </DialogTitle>
          <DialogDescription className="text-pretty text-[13.5px] leading-6 text-muted-foreground">
            Claude Code runs on this Mac and powers homework generation and answer summaries.
            This check is not a Relay sign-in and does not identify the teacher using Relay.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-2xl border border-border bg-muted/40">
          <CapabilityCheck
            isChecking={isChecking}
            isComplete={isInstalled}
            label="Claude Code installed"
          />
          <CapabilityCheck
            className="border-t border-border/70"
            isChecking={isChecking}
            isComplete={isAuthenticated}
            label="Claude Code authenticated"
          />
        </div>

        {!isChecking && !isReady ? (
          <div className="text-pretty text-[12.5px] leading-5 text-muted-foreground">
            <p>Install Claude Code, then sign in from Settings and re-check here.</p>
            {availability.problem ? (
              <p className="mt-2 text-destructive">{availability.problem}</p>
            ) : null}
          </div>
        ) : null}

        <p className="text-pretty text-[12.5px] leading-5 text-muted-foreground">
          Manage which Claude accounts this workspace generates with in Settings.
        </p>

        <DialogFooter className="items-stretch sm:items-center sm:justify-between">
          <Button
            className={CONTROL_FEEDBACK}
            variant="ghost"
            onClick={() => window.open(CLAUDE_INSTALL_GUIDE_URL, "_blank", "noopener,noreferrer")}
          >
            <HugeiconsIcon icon={LinkSquare02Icon} size={15} strokeWidth={1.9} />
            Install guide
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {!isReady ? (
              <Button
                className={CONTROL_FEEDBACK}
                variant="outline"
                disabled={isChecking}
                onClick={onRetry}
              >
                <HugeiconsIcon icon={ReloadIcon} size={15} strokeWidth={1.9} />
                Retry
              </Button>
            ) : null}
            <Button className={CONTROL_FEEDBACK} onClick={onContinue}>
              {isReady ? "Enter workspace" : "Continue without Claude"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CapabilityCheck({
  className,
  isChecking,
  isComplete,
  label,
}: {
  className?: string;
  isChecking: boolean;
  isComplete: boolean;
  label: string;
}) {
  const icon = isChecking
    ? Loading03Icon
    : isComplete
      ? CheckmarkCircle02Icon
      : CircleIcon;

  return (
    <div className={cn("flex items-center gap-3 px-4 py-2.5", className)}>
      <HugeiconsIcon
        className={cn(
          "shrink-0",
          isChecking && "animate-spin text-muted-foreground",
          !isChecking && isComplete && "text-primary",
          !isChecking && !isComplete && "text-ink-faint",
        )}
        icon={icon}
        size={17}
        strokeWidth={1.9}
      />
      <span className="text-[13px] font-medium text-foreground">{label}</span>
      <span className="ml-auto text-[11.5px] text-muted-foreground">
        {isChecking ? "Checking" : isComplete ? "Ready" : "Needs setup"}
      </span>
    </div>
  );
}

function getDialogTitle({
  isFirstRun,
  isInstalled,
  isReady,
}: {
  isFirstRun: boolean;
  isInstalled: boolean;
  isReady: boolean;
}) {
  if (isFirstRun) return "Welcome to Relay";
  if (isReady) return "Claude is ready";
  if (isInstalled) return "Finish Claude setup";
  return "Connect local Claude";
}
