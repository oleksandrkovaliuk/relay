const RELAY_MARK = `
  <svg viewBox="0 0 256 256" width="26" height="26" aria-hidden="true">
    <mask id="relay-mark-mask">
      <rect width="256" height="256" fill="white" />
      <circle cx="58" cy="55" r="10" fill="black" />
      <path d="M176 98h-66c-17 0-23 17-8 25l47 24c16 8 18 24 5 35l-14 12" fill="none" stroke="black" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" />
    </mask>
    <g fill="currentColor" mask="url(#relay-mark-mask)">
      <path d="M52 28c-10-3-20 4-23 15L16 108c-3 14 5 27 18 31l88 26c14 4 27-4 30-18l14-64c3-13-5-25-18-29L52 28Z" />
      <path d="M105 92h72c14 0 26 8 32 21l28 64c5 13-1 27-14 32l-60 24c-12 5-25 1-33-10l-49-72c-8-12-7-27 2-39 6-7 13-15 22-20Z" />
    </g>
  </svg>`;

const PAGE_STYLES = `
  :root { color-scheme: light; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f6f6f3; color: #1d1d1b; }
  main { width: min(100%, 390px); padding: 28px; border: 1px solid #e2e2dd; border-radius: 18px; background: #fff; box-shadow: 0 24px 70px -42px rgba(20, 20, 18, .34); }
  .brand { display: flex; align-items: center; gap: 9px; color: #268066; font-size: 17px; font-weight: 680; letter-spacing: -.04em; }
  .brand span { color: #1d1d1b; }
  .status { display: grid; place-items: center; width: 38px; height: 38px; margin-top: 34px; border-radius: 50%; background: #eaf7f1; color: #268066; }
  .status.error { background: #fff0ed; color: #b94734; }
  .avatar { position: relative; width: 52px; height: 52px; margin-top: 34px; }
  .avatar img { display: block; width: 100%; height: 100%; border: 1px solid #deded9; border-radius: 50%; object-fit: cover; }
  .avatar span { position: absolute; right: -2px; bottom: -2px; display: grid; place-items: center; width: 20px; height: 20px; border: 2px solid #fff; border-radius: 50%; background: #268066; color: #fff; }
  h1 { margin: 16px 0 0; font-size: 22px; line-height: 1.18; letter-spacing: -.035em; }
  p { margin: 9px 0 0; color: #696966; font-size: 13.5px; line-height: 1.55; }
  button { width: 100%; height: 42px; margin-top: 26px; border: 1px solid #deded9; border-radius: 11px; background: #fff; color: #242421; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; transition: background-color 140ms ease, transform 140ms ease; }
  button:hover { background: #f4f4f1; }
  button:active { transform: scale(.99); }
  button:focus-visible { outline: 2px solid #3a8f75; outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { button { transition: none; } }
`;

function renderPage(content: string, script = "") {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#f6f6f3" />
    <title>Relay</title>
    <style>${PAGE_STYLES}</style>
  </head>
  <body>
    <main>
      <div class="brand">${RELAY_MARK}<span>Relay</span></div>
      ${content}
    </main>
    ${script}
  </body>
</html>`;
}

export function renderSuccessfulRelayAuthPage(imageUrl?: string | null) {
  const profileImage = renderProfileImage(imageUrl);
  return renderPage(
    `${profileImage}
      <h1>You’re signed in</h1>
      <p>Relay is open and ready. You can safely close this browser tab.</p>
      <button type="button" onclick="window.close()">Close this tab</button>`,
    `<script>window.setTimeout(() => window.close(), 350)</script>`,
  );
}

function renderProfileImage(imageUrl?: string | null) {
  const safeImageUrl = normalizeProfileImageUrl(imageUrl);
  const checkIcon = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6" /></svg>`;
  if (!safeImageUrl) {
    return `<div class="status" aria-hidden="true">${checkIcon}</div>`;
  }
  return `<div class="avatar" aria-hidden="true">
      <img src="${safeImageUrl}" alt="" referrerpolicy="no-referrer" />
      <span>${checkIcon}</span>
    </div>`;
}

function normalizeProfileImageUrl(imageUrl?: string | null) {
  if (!imageUrl) return null;
  try {
    const url = new URL(imageUrl);
    if (url.protocol !== "https:") return null;
    return url.toString().replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  } catch {
    return null;
  }
}

export function renderFailedRelayAuthPage() {
  return renderPage(`<div class="status error" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 7v6" /><path d="M12 17h.01" /><circle cx="12" cy="12" r="9" /></svg>
    </div>
    <h1>Sign-in didn’t finish</h1>
    <p>Return to Relay and try again. Your account hasn’t been changed.</p>
    <button type="button" onclick="window.close()">Return to Relay</button>`);
}
