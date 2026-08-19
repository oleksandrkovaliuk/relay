import { ClerkProvider, useAuth } from "@clerk/electron/react";
import { RouterProvider } from "@tanstack/react-router";
import {
  AuthLoading,
  Authenticated,
  ConvexReactClient,
  Unauthenticated,
} from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache/provider";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@/styles.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RelaySignIn } from "@/auth/relay-sign-in";
import { RelayUserBootstrap } from "@/auth/relay-user-bootstrap";
import { applyTheme, readThemePreference } from "@/settings/theme";
import { RENDERER_SCHEME } from "@/shared/renderer-origin";
import { router } from "./router";

applyTheme(readThemePreference());

const rootElement = document.getElementById("app");
const convexUrl = import.meta.env.VITE_CONVEX_URL?.trim();
const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim();

if (!rootElement) throw new Error("Missing #app root element.");
if (!convexUrl) throw new Error("Missing VITE_CONVEX_URL. Run `pnpm dev` to configure Convex.");
if (!clerkPublishableKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY.");
}

const convex = new ConvexReactClient(convexUrl);
createRoot(rootElement).render(
  <StrictMode>
    <ClerkProvider
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
      routerPush={(to) => router.navigate({ href: to })}
      routerReplace={(to) => router.navigate({ href: to, replace: true })}
      // The SDK infers this from `window.location.protocol`; naming it makes the
      // requirement visible, since Clerk drops redirects to unlisted protocols.
      allowedRedirectProtocols={[`${RENDERER_SCHEME}:`]}
    >
      <AuthenticatedRelayApp />
    </ClerkProvider>
  </StrictMode>,
);

function AuthenticatedRelayApp() {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {/* Private subscriptions must close before Convex clears the JWT. */}
      <ConvexQueryCacheProvider maxIdleEntries={0}>
        <TooltipProvider delay={350}>
          <AuthLoading>
            <div className="grid min-h-screen place-items-center bg-workspace-surface text-[13px] text-muted-foreground">
              Connecting securely…
            </div>
          </AuthLoading>
          <Unauthenticated>
            <RelaySignIn />
          </Unauthenticated>
          <Authenticated>
            <RelayUserBootstrap>
              <RouterProvider router={router} />
            </RelayUserBootstrap>
          </Authenticated>
        </TooltipProvider>
      </ConvexQueryCacheProvider>
    </ConvexProviderWithClerk>
  );
}
