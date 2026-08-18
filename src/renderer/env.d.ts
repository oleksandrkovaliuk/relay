/// <reference types="vite/client" />

import type { TeacherDesktopApi } from "@/shared/claude";
import type { RelayAuthDesktopApi } from "@/shared/relay-auth";

declare global {
  interface Window {
    desktop?: TeacherDesktopApi;
    relayAuth?: RelayAuthDesktopApi;
  }
}

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL?: string;
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
  readonly VITE_PLAYER_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
