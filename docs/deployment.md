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

## Release checklist

- [ ] `pnpm check` passes against the release commit.
- [ ] Production Convex target is announced and confirmed before deployment.
- [ ] Production environment variables are present.
- [ ] Teacher auth/ownership tests pass for two isolated teachers.
- [ ] Public homework start, refresh/resume, submit, and feedback flows pass.
- [ ] Teacher preview matches the hosted player at desktop and mobile widths.
- [ ] Signed/notarized desktop app launches on a clean Mac without developer tools.
- [ ] `VITE_PLAYER_ORIGIN` points to the production player.
- [ ] Backup and restore drill has succeeded.
- [ ] Privacy copy and student-data retention rules are published.

## Primary references

- [Convex production deployments](https://docs.convex.dev/production/overview)
- [Convex custom hosting and production build URLs](https://docs.convex.dev/production/hosting/custom)
- [Convex environment variables](https://docs.convex.dev/production/environment-variables)
- [Electron packaging](https://www.electronjs.org/docs/latest/tutorial/tutorial-packaging)
- [Electron code signing and macOS notarization](https://www.electronjs.org/docs/latest/tutorial/code-signing)
