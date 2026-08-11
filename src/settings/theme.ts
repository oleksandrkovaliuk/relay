export const THEME_PREFERENCES = ["system", "light", "dark"] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

const STORAGE_KEY = "erm:theme:v1";
const DARK_QUERY = "(prefers-color-scheme: dark)";

export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return THEME_PREFERENCES.find((preference) => preference === stored) ?? "system";
  } catch {
    return "system";
  }
}

export function writeThemePreference(preference: ThemePreference) {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // The theme still applies for this session without browser storage.
  }
}

export function prefersDarkSystemTheme() {
  return window.matchMedia(DARK_QUERY).matches;
}

/**
 * Toggles the single `dark` class the whole token set hangs off. Called before
 * the first render too, so the app never flashes the wrong theme.
 */
export function applyTheme(preference: ThemePreference) {
  const isDark = preference === "dark" || (preference === "system" && prefersDarkSystemTheme());
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
}

/** Only meaningful while the preference is `system`. */
export function watchSystemTheme(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
