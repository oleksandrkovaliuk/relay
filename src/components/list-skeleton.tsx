import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ROW_KEYS = ["first", "second", "third", "fourth", "fifth", "sixth"];

/**
 * Stands in for a panel of rows while a query resolves. Matching the real
 * shape keeps the page from jumping once data lands, which a line of text with
 * a spinner cannot do.
 */
export function ListSkeleton({
  rows = 3,
  lines = 2,
  className,
  label = "Loading",
}: {
  rows?: number;
  lines?: number;
  className?: string;
  label?: string;
}) {
  const visibleRows = ROW_KEYS.slice(0, Math.max(1, Math.min(rows, ROW_KEYS.length)));

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn("panel divide-y divide-border/70 overflow-hidden", className)}
    >
      {visibleRows.map((rowKey) => (
        <div key={rowKey} className="grid gap-3 px-5 py-5 xl:px-6">
          <div className="flex items-center gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="ml-auto h-3 w-16" />
          </div>
          {lines > 1 ? (
            <div className="grid gap-2">
              <Skeleton className="h-2.5 w-full max-w-2xl" />
              <Skeleton className="h-2.5 w-2/3 max-w-lg" />
            </div>
          ) : null}
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
