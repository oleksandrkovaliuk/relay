import { useMutation } from "convex/react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@convex/_generated/api";

export function RelayUserBootstrap({ children }: { children: ReactNode }) {
  const ensureCurrentUser = useMutation(api.users.ensureCurrent);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const initializeUser = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      await ensureCurrentUser({});
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not initialize your account.");
      setStatus("error");
    }
  }, [ensureCurrentUser]);

  useEffect(() => {
    void initializeUser();
  }, [initializeUser]);

  if (status === "ready") return children;

  return (
    <div className="grid min-h-screen place-items-center bg-workspace-surface px-5 text-[13px] text-muted-foreground">
      {status === "loading" ? (
        <p className="flex items-center gap-2">
          <Spinner className="size-3.5" /> Preparing your private workspace…
        </p>
      ) : (
        <div className="grid max-w-sm justify-items-center gap-3 text-center">
          <p className="text-pretty text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void initializeUser()}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
