import { useClerk } from "@clerk/electron/react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Convex reports `isLoading` until it has either accepted a token or concluded the user is
 * signed out. A token that never validates leaves it loading forever, and this screen used
 * to be a dead end with no way back — the app looked broken with nothing to click.
 *
 * After a grace period long enough for a cold start on a slow connection, offer a way out.
 */
const SLOW_CONNECTION_MS = 12_000;

export function RelayConnecting() {
  const { signOut } = useClerk();
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setIsSlow(true), SLOW_CONNECTION_MS);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="grid min-h-screen place-items-center bg-workspace-surface px-5 text-center">
      <div className="grid max-w-[380px] justify-items-center gap-4">
        <p className="text-[13px] text-muted-foreground">Connecting securely…</p>
        {isSlow ? (
          <>
            <p className="text-pretty text-[13px] leading-5 text-muted-foreground">
              This is taking longer than expected. Your sign-in may have expired.
            </p>
            <Button variant="outline" size="sm" onClick={() => void signOut()}>
              Sign in again
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
