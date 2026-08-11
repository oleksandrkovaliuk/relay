import staticHosting from "@convex-dev/static-hosting/convex.config";
import { defineApp } from "convex/server";

/**
 * The student homework player is served from this deployment's site domain, so
 * students only need a browser and a share link. App HTTP routes live under
 * /api to leave the root to the static site.
 */
const app = defineApp({ httpPrefix: "/api" });
app.use(staticHosting, { httpPrefix: "/" });

export default app;
