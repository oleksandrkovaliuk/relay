import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const MAXIMUM_VISIBLE_DOTS = 14;

type HomeworkWizardProps = {
  /** 1-based index of the step on screen. */
  currentStep: number;
  totalSteps: number;
  /** Small uppercase-ish kicker above the prompt, e.g. the activity type. */
  eyebrow?: string;
  /** Rendered by PromptContent so numbered prompts become real lists. */
  prompt: ReactNode;
  instructions?: string;
  /** The interactive answer widget. */
  children: ReactNode;
  /** Extra content under the widget: errors, answer keys, teacher notes. */
  supplement?: ReactNode;
  /** Trailing header content. Defaults to the step's point value. */
  meta?: ReactNode;
  back?: ReactNode;
  next?: ReactNode;
  className?: string;
  bodyClassName?: string;
};

/**
 * The one step-by-step homework surface. Students answer in it and teachers
 * preview in it, so a draft can never look different from the real thing.
 */
export function HomeworkWizard({
  currentStep,
  totalSteps,
  eyebrow,
  prompt,
  instructions,
  children,
  supplement,
  meta,
  back,
  next,
  className,
  bodyClassName,
}: HomeworkWizardProps) {
  const safeTotalSteps = Math.max(1, totalSteps);
  const safeCurrentStep = Math.min(Math.max(1, currentStep), safeTotalSteps);

  return (
    <section
      data-slot="homework-wizard"
      className={cn(
        "flex w-full min-h-[34rem] flex-col overflow-hidden rounded-[22px] bg-card ring-1 ring-foreground/7",
        "shadow-[0_1px_2px_oklch(0_0_0/.04),0_12px_32px_-12px_oklch(0_0_0/.12)]",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-border/70 px-6 py-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <p className="shrink-0 text-[13px] font-medium text-muted-foreground numeric">
            Step {safeCurrentStep} of {safeTotalSteps}
          </p>
          <HomeworkStepDots currentStep={safeCurrentStep} totalSteps={safeTotalSteps} />
        </div>
        {meta ? <div className="shrink-0 text-[13px] text-muted-foreground">{meta}</div> : null}
      </header>

      <div
        className={cn(
          "flex flex-1 flex-col justify-center px-6 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12",
          bodyClassName,
        )}
      >
        <div className="phase-enter mx-auto w-full max-w-[46rem]">
          {eyebrow ? (
            <p className="text-[12px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          {prompt}
          {instructions ? (
            <p className="mt-3 text-pretty text-[14px] leading-6 text-muted-foreground sm:text-[15px] sm:leading-7">
              {instructions}
            </p>
          ) : null}
          <div className="mt-7 sm:mt-8">{children}</div>
          {supplement}
        </div>
      </div>

      {back || next ? (
        <footer className="flex items-center justify-between gap-4 border-t border-border/70 px-6 py-4 sm:px-8">
          <div className="flex min-w-0 items-center">{back}</div>
          <div className="flex min-w-0 items-center justify-end gap-3">{next}</div>
        </footer>
      ) : null}
    </section>
  );
}

/**
 * Progress rail: filled for finished steps, a wide pill for the current one,
 * muted for what is still ahead. Collapses to a bar past a readable dot count.
 */
export function HomeworkStepDots({
  currentStep,
  totalSteps,
  className,
}: {
  currentStep: number;
  totalSteps: number;
  className?: string;
}) {
  const safeTotalSteps = Math.max(1, totalSteps);
  const safeCurrentStep = Math.min(Math.max(1, currentStep), safeTotalSteps);
  const completionRatio = (safeCurrentStep - 1) / Math.max(1, safeTotalSteps - 1);

  return (
    <div
      role="progressbar"
      aria-label="Homework progress"
      aria-valuemin={1}
      aria-valuemax={safeTotalSteps}
      aria-valuenow={safeCurrentStep}
      aria-valuetext={`Step ${safeCurrentStep} of ${safeTotalSteps}`}
      className={cn("flex min-w-0 items-center", className)}
    >
      {safeTotalSteps > MAXIMUM_VISIBLE_DOTS ? (
        <span
          aria-hidden
          className="h-1.5 w-24 overflow-hidden rounded-full bg-foreground/10 sm:w-32"
        >
          <span
            className="block h-full rounded-full bg-primary transition-[width] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none"
            style={{ width: `${Math.max(6, completionRatio * 100)}%` }}
          />
        </span>
      ) : (
        <ol aria-hidden className="flex items-center gap-1.5">
          {Array.from({ length: safeTotalSteps }, (_, index) => {
            const step = index + 1;
            const isCurrent = step === safeCurrentStep;
            const isComplete = step < safeCurrentStep;
            return (
              <li
                key={step}
                className={cn(
                  "h-1.5 shrink-0 rounded-full transition-[width,background-color] duration-200 ease-[var(--ease-out)] motion-reduce:transition-none",
                  isCurrent && "w-6 bg-primary",
                  isComplete && "w-1.5 bg-primary/45",
                  !isCurrent && !isComplete && "w-1.5 bg-foreground/13",
                )}
              />
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** Full-page frame for the student player, so every panel shares one gutter. */
export function HomeworkWizardFrame({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-[100dvh] bg-background">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[62rem] flex-col justify-center px-4 py-6 sm:px-8 sm:py-10">
        {children}
      </div>
    </main>
  );
}
