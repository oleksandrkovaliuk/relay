import { useCallback, useState } from "react";

import type { ClaudeModel } from "@/shared/claude";
import { readClaudeModel, writeClaudeModel } from "./claude-model-preference";

/** The chosen model, and the setter that remembers it. */
export function useClaudeModel() {
  const [model, setModel] = useState<ClaudeModel>(readClaudeModel);

  return {
    model,
    setModel: useCallback(function choose(next: ClaudeModel) {
      writeClaudeModel(next);
      setModel(next);
    }, []),
  };
}
