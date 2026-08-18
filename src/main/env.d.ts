/**
 * electron-vite exposes `VITE_`-prefixed variables to the main process as well as the
 * renderer, inlining them at build time. The main process needs the publishable key to
 * derive Clerk's Frontend API host for its request interceptors.
 */
interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
