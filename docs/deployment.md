# Deployment plan

Relay is two products that share one Convex backend:

- **Teacher workspace:** an Electron desktop app that talks to the teacher's local Claude Code installation.
- **Student player:** a static Vite app served from the Convex deployment's site domain.

The cleanest first release keeps that split. It preserves local Claude credentials on the teacher's Mac and gives students a zero-install browser link.

## Release shape

```text
Teacher Mac
  Relay.app
    ├─ local Claude Code CLI + existing Claude login
    └─ Convex React client ───────────────┐
                                          │
Student browser                           ▼
  homework.example.com ────────────── Convex production
    static Vite player                 data + functions + static hosting
```

The Claude login is only an AI-provider credential. It must never become the teacher's Relay identity. Before a public release, add real teacher authentication and ownership checks to every teacher query and mutation; keep only share-token/resume-token student functions public.

## Phase 1 — private macOS pilot

1. Create the Convex production deployment and configure its production environment variables.
2. Run the full quality gate: `pnpm check`.
3. Deploy the Convex backend and student player together:

   ```sh
   pnpm exec static-hosting deploy \
     --dist out/web \
     --build-command "pnpm build:web"
   ```

   The static-hosting deploy command builds with the production Convex URL, deploys the backend, and uploads the static player in one flow.
4. Set `VITE_PLAYER_ORIGIN` when building the desktop app so copied homework links use the hosted player origin rather than localhost.
5. Package the teacher app with Electron Forge (or another Electron packager), add the final bundle identifier and app icon, then sign and notarize the macOS build.
6. Distribute the notarized build to a small set of teachers and monitor real homework completion, feedback, generation failures, and submission review latency.

## Phase 2 — production hardening

These are launch blockers, not polish:

- **Teacher authentication and authorization:** every student, draft, assignment, and submission must belong to an authenticated teacher/workspace.
- **Share-link boundaries:** retain unguessable assignment tokens and per-submission resume tokens; rate-limit public start/save/feedback mutations.
- **Recovery:** add production backups and a tested restore procedure before storing real student work.
- **Privacy:** publish a retention policy; avoid sending student identifiers to Claude unless the teacher has an appropriate legal basis and consent.
- **Observability:** capture Convex function failures and desktop generation failures without logging prompts, answers, resume tokens, or Claude credentials.
- **Release automation:** build signed macOS artifacts in CI, keep signing secrets in the CI secret store, and publish versioned updates only after `pnpm check` passes.

## Phase 3 — wider distribution

- Attach a custom player domain. Students see this URL, so it is branding: in the
  Convex dashboard add the domain under the deployment's HTTP/site domains, point
  a CNAME at the value Convex shows, then rebuild the desktop app with
  `VITE_PLAYER_ORIGIN=https://<the new domain>` so copied links use it. Existing
  links keep working — the share token is unchanged, only the origin moves.
  Convex custom domains require a paid plan.
- Add Windows packaging/signing only after the macOS pilot proves the workflow.
- Add automatic desktop updates after signing is stable. Electron requires signed builds for a trustworthy update path.
- Keep the student player independently deployable so question UX fixes do not require every teacher to update the desktop app.

## Sign-in domains: who hosts what

Nothing about authentication is a site you deploy. Clerk hosts the authentication
surfaces; the desktop app only listens briefly on loopback for the browser result.

| Surface | Hosted by | Development | Production |
| --- | --- | --- | --- |
| Clerk Frontend API — the JWT issuer Convex verifies | **Clerk** | `https://next-boa-5954.clerk.accounts.dev` | `https://clerk.<your-domain>` |
| Clerk sign-in and account portal | **Clerk** | Clerk development hosts | `https://accounts.<your-domain>` |
| Google's callback into Clerk | **Clerk** | `https://next-boa-5954.clerk.accounts.dev/v1/oauth_callback` | `https://clerk.<your-domain>/v1/oauth_callback` |
| The desktop app's own redirect | **the app**, on loopback | `http://127.0.0.1:42819/oauth/callback` | identical |
| Student player | **Convex static hosting** | `http://localhost:5180` | `https://<prod-deployment>.convex.site` |

`/v1/oauth_callback` is Clerk's endpoint on Clerk's servers. You never build or
deploy it — you paste it into the Google Cloud console as an authorized redirect
URI for your own Google OAuth client, which a production Clerk instance requires
(development instances borrow Clerk's shared Google app).

`clerk.<your-domain>` is also Clerk's, reached through DNS records you add at your
registrar — a CNAME for the Frontend API, another for the account portal, and mail
records so Clerk can send from your domain. Clerk prints the exact values; you
paste them and wait for verification. No server of yours answers those names.

### The Convex site domain cannot serve Clerk

`<deployment>.convex.site` serves the student player and Convex HTTP actions. It
cannot answer for `clerk.<your-domain>`: that hostname must resolve to Clerk, and
its certificate and routes belong to Clerk.

What you *can* share is the apex domain, which is usually what the question means:

```text
<whatever-domain-relay-ships-under>
├── clerk.<domain>      → CNAME to Clerk       (auth, hosted by Clerk)
├── accounts.<domain>   → CNAME to Clerk       (sign-in pages, hosted by Clerk)
└── homework.<domain>   → Convex custom domain (student player) — optional
```

Any domain you control works; it does not have to be related to the company that
builds Relay, and it is only ever a name in DNS. Nothing is deployed to it.

The player subdomain is optional. Leaving the player on `<deployment>.convex.site`
costs nothing and needs no DNS at all; a Convex custom domain is a paid feature and
buys only a nicer link for students. Auth does not care either way.

### If you would rather not own a domain

A Clerk production instance requires one. Two ways around it:

- **Stay on the development instance.** It works, but it is rate limited, uses
  Clerk's shared Google credentials on the consent screen, and is not meant to hold
  real users.
- **Use another identity provider.** That removes Clerk's domain requirement but
  requires replacing the Clerk SDK integration and migrating identity keys.

## Runbook: your own production Clerk instance

Clerk production instances cannot run on `*.accounts.dev`, so step 1 is not
optional. Everything after it is configuration — no server of yours is ever
involved in sign-in.

**1. Register a domain.** Any registrar works, including Vercel. The only
requirement is access to its DNS records; nothing needs to be deployed to it.

**2. Create the production instance.** Clerk dashboard → the Relay application →
*Deploy to production* (or create a production instance). It asks for the domain
and prints DNS records: a CNAME for `clerk.<domain>` (Frontend API), one for
`accounts.<domain>` (the hosted sign-in page), plus `clkmail` and two
`_domainkey` records for its email. Paste them into the registrar and wait for
Clerk to mark them verified. They sit alongside existing MX records safely.

In Clerk → *Settings* → *Branding*, leave **Remove "Secured by Clerk"
branding** turned off. Clerk branding remains visible, which avoids the paid
branding-removal feature.

**3. Create the Google OAuth client.** Google Cloud console → *APIs & Services* →
*Credentials* → *Create credentials* → *OAuth client ID* → **Web application**.

- Authorized redirect URIs: use the exact URI shown on Clerk's Google connection,
  normally `https://clerk.<domain>/v1/oauth_callback`.
- Authorized JavaScript origins: `https://<domain>`. Do not leave an empty row.

On the consent screen, add `<domain>` under *Authorized domains* and request the
`openid`, `email` and `profile` scopes. The domain must be one Google can verify,
which is the other reason step 1 comes first.

**4. Give Clerk those credentials.** Clerk → *SSO connections* → Google → use
custom credentials, and paste the client id and secret. Production instances do
not fall back to Clerk's shared Google app.

**5. Enable Clerk's native and Convex integrations.** Do **not** create a Clerk
OAuth Application; that feature is for letting third-party applications request
scoped access to Relay accounts.

- Clerk → *Native applications*: enable the Native API and add
  `http://127.0.0.1:42819/oauth/callback` to the SSO redirect allowlist. The
  desktop app serves it only while sign-in is open.
- Clerk → *Integrations* → *Convex*: activate the integration. This configures
  Clerk session tokens with the `aud: "convex"` claim Convex expects.
- Clerk → *Settings* → *Branding*: keep **Remove "Secured by Clerk" branding**
  off. The app renders Clerk's standard sign-in component and its attribution.

**6. Point Convex production at the Clerk token issuer.**

```bash
npx convex env set CLERK_FRONTEND_API_URL https://clerk.<domain> --prod
npx convex deploy
```

`CLERK_FRONTEND_API_URL` is public configuration: it is the `iss` value Convex
uses to locate Clerk's public signing keys. The provider audience is the constant
`convex`; there is no `CLERK_OAUTH_CLIENT_ID` or Clerk secret in the desktop app.

**7. Publish the student player, then build the desktop app.** In that order: the
player's URL is inlined into the desktop build.

```bash
pnpm deploy:web            # → https://<prod-deployment>.convex.site

VITE_CLERK_PUBLISHABLE_KEY=pk_live_... \
VITE_CONVEX_URL=https://<prod-deployment>.convex.cloud \
VITE_PLAYER_ORIGIN=https://<prod-deployment>.convex.site \
pnpm package:mac
```

For GitHub Releases, save all three `VITE_*` values as GitHub **Actions
variables** in the `production` environment. They are public build-time values,
not repository secrets. Keep Google OAuth client secrets, Convex deploy keys,
and code-signing credentials in GitHub **Actions secrets**.

**8. Verify.** Launch the packaged app: sign-in must open the production Clerk and
Google flow, return through the loopback callback, and load the workspace from the
production Convex deployment.

### What changes for existing sign-ins

Ownership is keyed on `tokenIdentifier`, which is `issuer|subject`. A production
instance is a new issuer, so the same person signing in becomes a new user row and
lands in an empty workspace. On a fresh production deployment that is exactly what
you want. If real data already exists under the development issuer, it needs
re-keying before the switch rather than after.

## Release checklist

- [ ] `pnpm check` passes against the release commit.
- [ ] Production Convex target is announced and confirmed before deployment.
- [ ] Production environment variables are present.
- [ ] Teacher auth/ownership tests pass for two isolated teachers.
- [ ] Public homework start, refresh/resume, submit, and feedback flows pass.
- [ ] Teacher preview matches the hosted player at desktop and mobile widths.
- [ ] Signed/notarized desktop app launches on a clean Mac without developer tools.
- [ ] `VITE_PLAYER_ORIGIN` points to the production player.
- [ ] A production Clerk instance exists, its DNS records verify, and Native
      applications allowlists `http://127.0.0.1:42819/oauth/callback`.
- [ ] Clerk's Convex integration is active and the session audience is `convex`.
- [ ] Clerk's **Remove "Secured by Clerk" branding** option is off.
- [ ] `VITE_CLERK_PUBLISHABLE_KEY` is the production `pk_live_...` key in the
      GitHub production environment.
- [ ] Convex production has `CLERK_FRONTEND_API_URL=https://clerk.<domain>`.
- [ ] Backup and restore drill has succeeded.
- [ ] Privacy copy and student-data retention rules are published.

## Primary references

- [Convex production deployments](https://docs.convex.dev/production/overview)
- [Convex custom hosting and production build URLs](https://docs.convex.dev/production/hosting/custom)
- [Convex environment variables](https://docs.convex.dev/production/environment-variables)
- [Electron packaging](https://www.electronjs.org/docs/latest/tutorial/tutorial-packaging)
- [Electron code signing and macOS notarization](https://www.electronjs.org/docs/latest/tutorial/code-signing)
