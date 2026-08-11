import { ChevronRight } from "lucide-react";
import { useId, useState } from "react";

import { cn } from "@/lib/utils";

export type ReferenceRule = {
  term: string;
  explanation: string;
};

/**
 * The cheat sheet at the top of a worksheet: closed by default so it never gets
 * in the way, one tap from the student who needs it. The term column is set in
 * mono so the forms line up and can be scanned without reading.
 */
export function ReferenceRules({
  rules,
  className,
}: {
  rules: ReferenceRule[];
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const bodyId = useId();

  if (rules.length === 0) return null;

  return (
    <section
      className={cn("overflow-hidden rounded-xl border border-border bg-card", className)}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={bodyId}
        onClick={() => setIsOpen((wasOpen) => !wasOpen)}
        className="flex w-full items-center gap-2 px-4 py-3.5 text-left font-mono text-[12px] uppercase tracking-[0.09em] text-ink outline-none transition-colors duration-150 hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <ChevronRight
          size={14}
          aria-hidden
          className={cn(
            "shrink-0 text-amber-600 transition-transform duration-200 ease-[var(--ease-out)] motion-reduce:transition-none",
            isOpen && "rotate-90",
          )}
        />
        {isOpen ? "Close the cheat sheet" : "Open the cheat sheet"}
      </button>
      {isOpen ? (
        <dl id={bodyId} className="grid border-t border-dashed border-border px-4 pb-4">
          {rules.map((rule) => (
            <div
              key={rule.term}
              className="grid gap-x-3.5 border-b border-dotted border-border py-3 last:border-b-0 sm:grid-cols-[7rem_minmax(0,1fr)]"
            >
              <dt className="pt-0.5 font-mono text-[12px] leading-5 text-primary">{rule.term}</dt>
              <dd className="text-pretty text-[14px] leading-6 text-ink">{rule.explanation}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
