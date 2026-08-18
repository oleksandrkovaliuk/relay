import { ClerkProvider, useAuth } from "@clerk/react";
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
const relayOAuthTransport = {
  getRedirectUrl: async () => getRelayAuthDesktopApi().getRelayAuthRedirectUrl(),
  open: async (url: URL) => ({
    callbackUrl: await getRelayAuthDesktopApi().openRelayAuthAuthorization(url.toString()),
  }),
};

createRoot(rootElement).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      __internal_oauthTransport={relayOAuthTransport}
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

function getRelayAuthDesktopApi() {
  if (!window.relayAuth) {
    throw new Error("Relay's desktop authentication bridge is unavailable.");
  }
  return window.relayAuth;
}
