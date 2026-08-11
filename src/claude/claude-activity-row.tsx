import {
  Check,
  FileText,
  KeyRound,
  PenLine,
  Sparkles,
  Square,
  Terminal,
  X,
} from "lucide-react";
import type { ComponentType } from "react";

import { cn } from "@/lib/utils";
import type { ClaudeActivityKind } from "./claude-activity";

const ACTIVITY_ICONS: Record<ClaudeActivityKind, ComponentType<{ size?: number }>> = {
  request: FileText,
  runtime: Sparkles,
  tool: Terminal,
  streaming: PenLine,
  authentication: KeyRound,
  completion: Check,
  cancelled: Square,
  failed: X,
};

/**
 * One line of runtime activity, in the shape a coding agent uses: a small glyph,
 * the action in normal weight, then the technical tail dimmed. The step still
 * running shimmers so it is obvious the app has not stalled.
 */
export function ClaudeActivityRow({
  kind,
  label,
  detail,
  isActive = false,
  trailing,
  className,
}: {
  kind: ClaudeActivityKind;
  label: string;
  detail?: string;
  isActive?: boolean;
  trailing?: string;
  className?: string;
}) {
  const Icon = ACTIVITY_ICONS[kind];

  return (
    <div className={cn("flex min-w-0 items-start gap-2.5 text-[12.5px] leading-5", className)}>
      {/* A line-height-tall box centres the glyph on the first text line
          without magic offsets. */}
      <span
        aria-hidden
        className={cn(
          "flex h-5 w-3 shrink-0 items-center justify-center",
          kind === "failed"
            ? "text-destructive"
            : kind === "completion"
              ? "text-primary"
              : "text-muted-foreground/70",
        )}
      >
        <Icon size={12} />
      </span>
      <span className="min-w-0 flex-1 truncate">
        <span
          className={cn(
            kind === "failed" ? "text-destructive" : "text-secondary-foreground",
            isActive && kind !== "failed" && "activity-shimmer",
          )}
        >
          {label}
        </span>
        {detail ? (
          <span className="ml-1.5 font-mono text-[11.5px] text-muted-foreground/60">{detail}</span>
        ) : null}
      </span>
      {trailing ? (
        <span className="shrink-0 text-[11px] text-muted-foreground/55 numeric">{trailing}</span>
      ) : null}
    </div>
  );
}
