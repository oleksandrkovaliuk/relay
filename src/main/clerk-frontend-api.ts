/**
 * A Clerk publishable key is `pk_test_` or `pk_live_` followed by the base64 of
 * the instance's Frontend API host with a `$` terminator. Deriving the host from
 * the key keeps development and production on the same code path — hardcoding the
 * production host silently broke every development run.
 */
const PUBLISHABLE_KEY_PREFIXES = ["pk_test_", "pk_live_"];
const HOST_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

export function resolveClerkFrontendApiHost(publishableKey: string | undefined) {
  const key = publishableKey?.trim();
  const prefix = key && PUBLISHABLE_KEY_PREFIXES.find((candidate) => key.startsWith(candidate));
  if (!key || !prefix) return null;

  const encodedHost = key.slice(prefix.length);
  if (!encodedHost) return null;

  let decodedHost: string;
  try {
    decodedHost = Buffer.from(encodedHost, "base64").toString("utf8");
  } catch {
    return null;
  }

  // Clerk terminates the encoded host with `$`; a key truncated mid-host decodes
  // to something host-shaped but wrong, so require the terminator.
  if (!decodedHost.endsWith("$")) return null;
  const host = decodedHost.slice(0, -1);
  return HOST_PATTERN.test(host) ? host : null;
}
