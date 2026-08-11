import { Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatElapsedSeconds } from "@/lib/utils";
import type { ClaudeActivityEntry } from "./claude-activity";
import { ClaudeActivityRow } from "./claude-activity-row";

const AUTOSCROLL_SLACK_PIXELS = 80;

/** Live runtime log shown while Claude is drafting, with a stop control. */
export function ClaudeActivityPanel({
  activities,
  isRunning,
  onStop,
  startedAt,
}: {
  activities: ClaudeActivityEntry[];
  isRunning: boolean;
  onStop?: () => void;
  startedAt: number;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(function tickWhileRunning() {
    setCurrentTime(Date.now());
    if (!isRunning) return;
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [isRunning, startedAt]);

  useEffect(function followTheLatestEvent() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const remainingScroll = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    if (remainingScroll > AUTOSCROLL_SLACK_PIXELS) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [activities.length]);

  const elapsedSeconds = Math.max(0, Math.floor((currentTime - startedAt) / 1_000));

  return (
    <section aria-label="Claude activity" className="status-enter panel overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-4 py-2.5">
        <p className="min-w-0 truncate text-[12px] font-medium text-muted-foreground numeric">
          {isRunning
            ? `Working · ${formatElapsedSeconds(elapsedSeconds)}`
            : `Finished · ${formatElapsedSeconds(elapsedSeconds)}`}
        </p>
        {onStop ? (
          <Button variant="ghost" size="xs" className="shrink-0" onClick={onStop}>
            <Square size={8} fill="currentColor" aria-hidden /> Stop
          </Button>
        ) : null}
      </div>

      <div className="border-t border-border/70">
        <ScrollArea className="max-h-56" viewportClassName="max-h-56" viewportRef={viewportRef}>
          <ClaudeActivityLog
            activities={activities}
            isRunning={isRunning}
            className="px-4 py-3"
          />
        </ScrollArea>
      </div>

      <p className="sr-only" aria-live="polite">
        {activities.at(-1)?.label}
      </p>
    </section>
  );
}

/** Collapsed version kept next to a finished draft for after-the-fact review. */
export function ClaudeActivityDisclosure({
  activities,
}: {
  activities: ClaudeActivityEntry[];
}) {
  if (activities.length === 0) return null;

  return (
    <details className="group panel overflow-hidden">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-4 py-2.5 text-[12.5px] font-medium text-secondary-foreground marker:hidden">
        <span>Generation activity</span>
        <span className="numeric text-[11.5px] font-normal text-muted-foreground">
          {activities.length} steps · <span className="group-open:hidden">Show</span>
          <span className="hidden group-open:inline">Hide</span>
        </span>
      </summary>
      <div className="border-t border-border/70">
        <ScrollArea className="max-h-52" viewportClassName="max-h-52">
          <ClaudeActivityLog activities={activities} isRunning={false} className="px-4 py-3" />
        </ScrollArea>
      </div>
    </details>
  );
}

export function ClaudeActivityLog({
  activities,
  isRunning,
  className,
}: {
  activities: ClaudeActivityEntry[];
  isRunning: boolean;
  className?: string;
}) {
  return (
    <ol className={cn("grid gap-1.5", className)}>
      {activities.map((entry, index) => {
        const isLast = index === activities.length - 1;
        return (
          <li key={entry.id}>
            <ClaudeActivityRow
              kind={entry.kind}
              label={entry.label}
              detail={entry.detail}
              isActive={isRunning && isLast}
              trailing={`+${formatElapsedSeconds(Math.floor(entry.elapsedMilliseconds / 1_000))}`}
            />
          </li>
        );
      })}
    </ol>
  );
}
