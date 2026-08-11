import { useCallback, useEffect, useState } from "react";

import {
  applyTheme,
  readThemePreference,
  watchSystemTheme,
  writeThemePreference,
  type ThemePreference,
} from "./theme";

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(readThemePreference);

  useEffect(function applyAndPersist() {
    applyTheme(preference);
    writeThemePreference(preference);
  }, [preference]);

  useEffect(function followTheSystemWhenAsked() {
    if (preference !== "system") return;
    return watchSystemTheme(() => applyTheme("system"));
  }, [preference]);

  return {
    preference,
    setPreference: useCallback(function choose(next: ThemePreference) {
      setPreference(next);
    }, []),
  };
}
