import { useAuth, useClerk } from "@clerk/electron/react";
import { useState } from "react";

import { RelayLogo } from "@/components/relay-logo";
import { Button } from "@/components/ui/button";
import { RelaySignIn } from "@/auth/relay-sign-in";

/**
 * Convex reports the user as unauthenticated whenever it has no accepted token — including
 * when Clerk still holds a valid session but a token fetch failed, which a dropped
 * connection or an expired token is enough to cause.
 *
 * Rendering the sign-in component in that state produced an empty screen, because Clerk's
 * `<SignIn>` renders nothing for a user who is already signed in. The result looked like a
 * crash and offered nothing to click. Distinguish the two states so this one is explicable
 * and recoverable.
 */
export function RelaySessionGate() {
  const { isSignedIn } = useAuth();

  if (!isSignedIn) return <RelaySignIn />;
  return <SessionRecovery />;
}

function SessionRecovery() {
  const { signOut } = useClerk();
  const [isSigningOut, setIsSigningOut] = useState(false);

  return (
    <main className="grid min-h-screen place-items-center bg-workspace-surface px-5 py-12 text-foreground">
      <section className="grid w-full max-w-[420px] justify-items-center gap-5 text-center">
        <RelayLogo markSize={25} />
        <div className="grid gap-2">
          <h1 className="text-[15px] font-medium">We could not verify your session</h1>
          <p className="text-pretty text-[13.5px] leading-5 text-muted-foreground">
            You are signed in, but Relay could not confirm it with the workspace. This is
            usually a connection problem and clears on its own.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={isSigningOut}
          onClick={() => {
            setIsSigningOut(true);
            void signOut();
          }}
        >
          Sign in again
        </Button>
      </section>
    </main>
  );
}
