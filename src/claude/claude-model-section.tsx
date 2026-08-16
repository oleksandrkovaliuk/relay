import { cn } from "@/lib/utils";
import { CLAUDE_MODELS } from "@/shared/claude";
import { useClaudeModel } from "./use-claude-model";

/**
 * Which model writes the homework. It is a real trade — a full set is one large
 * structured answer, so the model choice is mostly a choice about how long the
 * teacher waits — so each option says what it costs in time rather than naming
 * a tier and leaving them to guess.
 */
export function ClaudeModelSection() {
  const { model, setModel } = useClaudeModel();

  return (
    <div role="radiogroup" aria-label="Claude model" className="grid gap-2.5 sm:grid-cols-3">
      {CLAUDE_MODELS.map((option) => {
        const isSelected = model === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => setModel(option.id)}
            className={cn(
              "grid gap-0.5 rounded-xl border px-3.5 py-3 text-left transition-[background-color,border-color] duration-150",
              isSelected
                ? "border-primary/45 bg-primary-soft/60"
                : "border-border bg-card hover:border-input hover:bg-muted/40",
            )}
          >
            <span className="text-[13px] font-medium text-foreground">{option.label}</span>
            <span className="text-pretty text-[12px] leading-[17px] text-muted-foreground">
              {option.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
