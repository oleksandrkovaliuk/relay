const DEFAULT_LOCAL_PLAYER_ORIGIN = "http://localhost:5180";

function playerOrigin() {
  return import.meta.env.VITE_PLAYER_ORIGIN?.trim() || DEFAULT_LOCAL_PLAYER_ORIGIN;
}

export function buildShareUrl(shareToken: string) {
  return `${playerOrigin().replace(/\/$/, "")}/?h=${shareToken}`;
}

export function isPlayerPublished() {
  return Boolean(import.meta.env.VITE_PLAYER_ORIGIN?.trim());
}
