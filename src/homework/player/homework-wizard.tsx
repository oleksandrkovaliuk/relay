import type { ReactNode } from "react";

import { RelayLogo } from "@/components/relay-logo";
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
  /**
   * Content above everything else on the step — the cheat sheet lives here.
   * A reference the student is meant to consult while answering has to be where
   * they land, not under a screen of activities they have to scroll past.
   */
  aside?: ReactNode;
  /** Extra content under the widget: errors, answer keys, teacher notes. */
  supplement?: ReactNode;
  /** Teacher-only tools that should float above the navigation footer. */
  floatingPanel?: ReactNode;
  /** Trailing header content. Defaults to the step's point value. */
  meta?: ReactNode;
  back?: ReactNode;
  next?: ReactNode;
  /** One entry per step: whether it already holds an answer. */
  answeredSteps?: boolean[];
  /** Makes the step rail navigable, so a skipped step can be returned to. */
  onSelectStep?: (step: number) => void;
  /** What one step is called here: a student walks sections, not activities. */
  stepNoun?: string;
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
  aside,
  supplement,
  floatingPanel,
  meta,
  back,
  next,
  answeredSteps,
  onSelectStep,
  stepNoun = "Step",
  className,
  bodyClassName,
}: HomeworkWizardProps) {
  const safeTotalSteps = Math.max(1, totalSteps);
  const safeCurrentStep = Math.min(Math.max(1, currentStep), safeTotalSteps);

  return (
    <section
      data-slot="homework-wizard"
      className={cn(
        "relative flex w-full min-h-[34rem] flex-col overflow-hidden rounded-[22px] border border-border/70 bg-card",
        "shadow-[0_1px_2px_oklch(0_0_0/.04),0_12px_32px_-12px_oklch(0_0_0/.12)]",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border/70 px-4 py-3.5 sm:px-8 sm:py-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <p className="shrink-0 text-[13px] font-medium text-muted-foreground numeric">
            {stepNoun} {safeCurrentStep} of {safeTotalSteps}
          </p>
          <HomeworkStepDots
            currentStep={safeCurrentStep}
            totalSteps={safeTotalSteps}
            answeredSteps={answeredSteps}
            onSelectStep={onSelectStep}
          />
        </div>
        {meta ? <div className="shrink-0 text-[13px] text-muted-foreground">{meta}</div> : null}
      </header>

      <div
        className={cn(
          "flex flex-1 flex-col justify-center px-4 py-7 sm:px-8 sm:py-10 lg:px-12 lg:py-12",
          // Room for the floating panel, so the collapsed pill never sits on text.
          floatingPanel && "pb-20 sm:pb-20 lg:pb-20",
          bodyClassName,
        )}
      >
        <div className="phase-enter mx-auto w-full max-w-[46rem]">
          {aside ? <div className="mb-6">{aside}</div> : null}
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

      {/* Out of flow on purpose: a panel that grows must not push the card's own
          content down. It is anchored above the footer and expands upward. */}
      {floatingPanel ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-[4.25rem] z-20 flex justify-center px-4 sm:px-8">
          {/* The panel may ask for more width than the card has; this is what
              bounds it, so the panel itself needs no viewport maths. */}
          <div className="pointer-events-auto w-full max-w-[34rem]">{floatingPanel}</div>
        </div>
      ) : null}

      {back || next ? (
        <footer className="flex items-center justify-between gap-2 border-t border-border/70 px-3 py-3 sm:gap-4 sm:px-8 sm:py-4">
          <div className="flex min-w-0 items-center">{back}</div>
          <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-3">{next}</div>
        </footer>
      ) : null}
    </section>
  );
}

/**
 * Progress rail: filled for answered steps, a wide pill for the current one,
 * muted for what is unanswered — so a step skipped earlier stays visibly open.
 * Collapses to a bar past a readable dot count.
 */
export function HomeworkStepDots({
  currentStep,
  totalSteps,
  answeredSteps,
  onSelectStep,
  className,
}: {
  currentStep: number;
  totalSteps: number;
  answeredSteps?: boolean[];
  onSelectStep?: (step: number) => void;
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
        <ol className="flex items-center gap-1.5">
          {Array.from({ length: safeTotalSteps }, (_, index) => {
            const step = index + 1;
            const isCurrent = step === safeCurrentStep;
            const isAnswered = answeredSteps
              ? (answeredSteps[index] ?? false)
              : step < safeCurrentStep;
            const dotClassName = cn(
              "block h-1.5 shrink-0 rounded-full transition-[width,background-color] duration-200 ease-[var(--ease-out)] motion-reduce:transition-none",
              isCurrent && "w-6 bg-primary",
              !isCurrent && isAnswered && "w-1.5 bg-primary/45",
              !isCurrent && !isAnswered && "w-1.5 bg-foreground/16",
            );
            return (
              <li key={step} className="flex">
                {onSelectStep ? (
                  <button
                    type="button"
                    aria-current={isCurrent ? "step" : undefined}
                    aria-label={`Step ${step}${isAnswered ? ", answered" : ", not answered yet"}`}
                    onClick={() => onSelectStep(step)}
                    /* Dots are 6px tall, so the hit area is padded out to a
                       thumb-sized target without changing the layout. */
                    className="-my-2.5 grid place-items-center rounded-full px-0.5 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span aria-hidden className={dotClassName} />
                  </button>
                ) : (
                  <span aria-hidden className={dotClassName} />
                )}
              </li>
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
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[62rem] flex-col px-4 py-6 sm:px-8 sm:py-8">
        <header className="flex shrink-0 justify-center pb-6 sm:pb-8">
          <RelayLogo markSize={22} />
        </header>
        <div className="flex flex-1 flex-col justify-center">{children}</div>
      </div>
    </main>
  );
}
