import { ClerkProvider, useAuth } from "@clerk/electron/react";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { StrictMode, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

import "@/styles.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RelayConnecting } from "@/auth/relay-connecting";
import { RelaySessionGate } from "@/auth/relay-session-recovery";
import { RelayUserBootstrap } from "@/auth/relay-user-bootstrap";
import { applyTheme, readThemePreference } from "@/settings/theme";
import { RENDERER_SCHEME } from "@/shared/renderer-origin";
import { convexClient, queryClient } from "./clients";
import { createClerkRouterCallbacks } from "./clerk-navigation";
import { router } from "./router";

applyTheme(readThemePreference());

const rootElement = document.getElementById("app");
const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim();

if (!rootElement) throw new Error("Missing #app root element.");
if (!clerkPublishableKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY.");
}
const clerkRouter = createClerkRouterCallbacks({
  navigate: (path, options) => router.navigate({ to: path, replace: options.replace }),
  onError: (path, cause) => console.error(`Could not navigate to ${path}:`, cause),
});
createRoot(rootElement).render(
  <StrictMode>
    {window.desktop ? <ClerkProvider
      publishableKey={clerkPublishableKey}
      /*
       * Clerk's dashboard points `after_sign_in_url` at the marketing site
       * (https://relay.democrat), because that is where the web app lives. Left alone,
       * clerk-js navigates the desktop renderer there the moment sign-in succeeds, the
       * main process bounces the external URL to the system browser, and Clerk retries —
       * an endless loop that opens browser tabs instead of finishing sign-in. Forcing
       * both redirects to the in-app root keeps the desktop flow inside the desktop app.
       */
      signInForceRedirectUrl="/"
      signUpForceRedirectUrl="/"
      // Sign-out has the same trap: the dashboard sends it to
      // https://accounts.relay.democrat/sign-in/choose, which would bounce the desktop app
      // out to the browser instead of returning it to its own sign-in screen.
      afterSignOutUrl="/"
      /*
       * Any navigation Clerk does decide to make goes through the app's own router rather
       * than `window.location`, so it can never leave the renderer's origin.
       */
      routerPush={clerkRouter.routerPush}
      routerReplace={clerkRouter.routerReplace}
      // The SDK infers this from `window.location.protocol`; naming it makes the
      // requirement visible, since Clerk drops redirects to unlisted protocols.
      allowedRedirectProtocols={[`${RENDERER_SCHEME}:`]}
    >
      <AuthenticatedRelayApp />
    </ClerkProvider> : <DesktopRequired />}
  </StrictMode>,
);

function AuthenticatedRelayApp() {
  return (
    <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delay={350}>
          <AuthLoading>
            <RelayConnecting />
          </AuthLoading>
          <Unauthenticated>
            <RelaySessionGate />
          </Unauthenticated>
          <Authenticated>
            <SessionCacheReset />
            <RelayUserBootstrap>
              <RouterProvider router={router} />
            </RelayUserBootstrap>
          </Authenticated>
        </TooltipProvider>
      </QueryClientProvider>
    </ConvexProviderWithClerk>
  );
}

/**
 * One teacher's cached data must never be shown to the next, so the cache is emptied when
 * the session identity changes. This used to be a `key` on the provider, which remounted
 * the router and every screen under it — including on the first render after sign-in,
 * when Clerk's session id arrives and changes the key from `undefined`. That remount tore
 * down live Convex subscriptions while the components watching them stayed mounted, which
 * is why a page could sit on its skeleton for good, and why navigation flashed.
 */
function SessionCacheReset() {
  const { sessionId } = useAuth();
  const previousSessionId = useRef(sessionId);

  useEffect(() => {
    if (previousSessionId.current === sessionId) return;
    previousSessionId.current = sessionId;
    queryClient.clear();
  }, [sessionId]);

  return null;
}

function DesktopRequired() {
  return <main className="flex min-h-screen items-center justify-center bg-background p-8">
    <div className="max-w-md text-center">
      <h1 className="text-3xl font-medium tracking-tight">Your teaching workspace lives in Relay</h1>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">Open the Relay desktop app to sign in, create homework and work with Claude. Student homework links open directly in a browser.</p>
      <p className="mt-6 rounded-2xl bg-muted p-4 text-xs leading-5 text-muted-foreground">This address serves the desktop workspace. Sign in from the Relay window to continue.</p>
    </div>
  </main>;
}
