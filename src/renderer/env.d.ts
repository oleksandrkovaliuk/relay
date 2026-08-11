/// <reference types="vite/client" />

import type { TeacherDesktopApi } from "@/shared/claude";

declare global {
  interface Window {
    desktop?: TeacherDesktopApi;
  }
}

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL?: string;
  readonly VITE_PLAYER_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
