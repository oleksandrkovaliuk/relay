import { Monitor, Moon, Sun } from "lucide-react";
import type { ComponentType } from "react";

import { cn } from "@/lib/utils";
import { THEME_PREFERENCES, type ThemePreference } from "./theme";
import { useTheme } from "./use-theme";

const THEME_OPTIONS: Record<
  ThemePreference,
  { label: string; description: string; icon: ComponentType<{ size?: number }> }
> = {
  system: {
    label: "Match system",
    description: "Follows macOS automatically.",
    icon: Monitor,
  },
  light: { label: "Light", description: "The default teaching canvas.", icon: Sun },
  dark: { label: "Dark", description: "Easier for evening lessons.", icon: Moon },
};

export function AppearanceSection() {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="grid gap-2.5 sm:grid-cols-3"
    >
      {THEME_PREFERENCES.map((option) => {
        const { label, description, icon: Icon } = THEME_OPTIONS[option];
        const isSelected = preference === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => setPreference(option)}
            className={cn(
              "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-[background-color,border-color] duration-150",
              isSelected
                ? "border-primary/45 bg-primary-soft/60"
                : "border-border bg-card hover:border-input hover:bg-muted/40",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "mt-0.5 shrink-0",
                isSelected ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon size={15} />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-foreground">{label}</span>
              <span className="mt-0.5 block text-pretty text-[12px] leading-[17px] text-muted-foreground">
                {description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
