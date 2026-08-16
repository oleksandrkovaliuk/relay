const DEFAULT_LOCAL_PLAYER_ORIGIN = "http://localhost:5180";

export function resolvePlayerOrigin(
  configuredOrigin: string | undefined,
  isDevelopment: boolean,
) {
  const origin = configuredOrigin?.trim();

  if (!origin) {
    if (isDevelopment) return DEFAULT_LOCAL_PLAYER_ORIGIN;

    throw new Error(
      "Missing VITE_PLAYER_ORIGIN. Configure the hosted student player URL before building a release.",
    );
  }

  const url = new URL(origin);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("VITE_PLAYER_ORIGIN must use http:// or https://.");
  }

  return url.origin;
}

function playerOrigin() {
  return resolvePlayerOrigin(import.meta.env.VITE_PLAYER_ORIGIN, import.meta.env.DEV);
}

export function buildShareUrl(shareToken: string) {
  const url = new URL(playerOrigin());
  url.searchParams.set("h", shareToken);
  return url.toString();
}

export function isPlayerPublished() {
  return Boolean(import.meta.env.VITE_PLAYER_ORIGIN?.trim());
}
