import { cn } from "@/lib/utils";

const WEAK_SCORE_THRESHOLD = 50;
const STRONG_SCORE_THRESHOLD = 80;

/** A single-glance accuracy meter used wherever a submission score is listed. */
export function ScoreBar({
  percentage,
  className,
}: {
  percentage: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={`${clamped}% correct`}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-foreground/10", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none",
          clamped < WEAK_SCORE_THRESHOLD && "bg-destructive",
          clamped >= WEAK_SCORE_THRESHOLD && clamped < STRONG_SCORE_THRESHOLD && "bg-amber-500",
          clamped >= STRONG_SCORE_THRESHOLD && "bg-primary",
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
