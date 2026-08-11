import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The one page-section heading used by every workspace view, so Today,
 * Homework, and Insights keep identical rhythm.
 */
export function SectionHeading({
  id,
  title,
  description,
  action,
  className,
}: {
  id?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-2", className)}>
      <div className="min-w-0">
        <h2
          id={id}
          className="text-balance text-[17px] font-semibold tracking-[-0.02em] xl:text-[19px]"
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-pretty text-[13px] leading-5 text-muted-foreground xl:text-[14px]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
