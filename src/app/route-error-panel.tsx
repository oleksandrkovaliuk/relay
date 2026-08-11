import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * A page-level failure must not take the workspace chrome with it: the teacher
 * needs the sidebar to get somewhere useful again.
 */
export function RouteErrorPanel({
  error,
  reset,
}: {
  error: Error;
  reset?: () => void;
}) {
  const [areDetailsVisible, setAreDetailsVisible] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[46rem] px-6 py-14 lg:px-10">
      <div className="panel px-6 py-7 sm:px-8">
        <div className="grid size-10 place-items-center rounded-full bg-critical-soft text-destructive">
          <AlertTriangle size={19} aria-hidden />
        </div>
        <h2 className="mt-5 text-balance text-[20px] font-semibold tracking-[-0.03em]">
          This page could not load.
        </h2>
        <p className="mt-2 max-w-xl text-pretty text-[13.5px] leading-6 text-muted-foreground">
          The rest of the workspace still works. If this started right after a code change, run{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12.5px]">pnpm dev</code> so
          Convex deploys the latest functions.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {reset ? (
            <Button size="lg" onClick={reset}>
              Try again
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="lg"
            onClick={() => setAreDetailsVisible((areVisible) => !areVisible)}
          >
            {areDetailsVisible ? "Hide details" : "Show details"}
          </Button>
        </div>

        {areDetailsVisible ? (
          <pre className="mt-4 max-h-56 overflow-auto rounded-xl bg-muted/60 px-3.5 py-3 text-[12px] leading-5 whitespace-pre-wrap text-secondary-foreground">
            {error.message}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
