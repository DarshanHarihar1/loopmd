# Releasing loopmd

Publishing is automated by [`.github/workflows/publish.yml`](./.github/workflows/publish.yml).
It runs the full gate (lint, typecheck, test, build), checks the version, and publishes to npm
with a [provenance](https://docs.npmjs.com/generating-provenance-statements/) attestation.

## One-time setup

Pick **one** authentication method.

### Option A — Trusted Publishing (recommended, no token)

npm [Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) uses GitHub's OIDC, so there
is no long-lived token to leak, and provenance is generated automatically.

1. On npmjs.com → the `loopmd` package → **Settings → Trusted Publishers → Add**.
2. Choose **GitHub Actions** and enter:
   - Organization/user: `DarshanHarihar1`
   - Repository: `loopmd`
   - Workflow filename: `publish.yml`
   - Environment: *(leave blank, or set one and add `environment:` to the job to harden)*
3. Done — the workflow already requests `id-token: write`, and npm 11.5.1+ (installed in the
   workflow) authenticates over OIDC. No secret needed.

### Option B — Automation token (fallback)

1. On npmjs.com → **Access Tokens → Generate** → **Automation** token.
2. In the GitHub repo → **Settings → Secrets and variables → Actions** → add `NPM_TOKEN`.

The workflow uses the token if trusted publishing isn't configured.

## Cutting a release

1. Bump the version on `main` (this drives `loopmd --version` and the publish):
   ```sh
   npm version patch    # or minor / major → commits and creates tag vX.Y.Z
   git push --follow-tags
   ```
2. Create a **GitHub Release** for that tag (`vX.Y.Z`) — Releases → Draft a new release → pick the
   tag → Publish.
3. The `Publish` workflow runs, verifies the tag matches `package.json` and the version is
   unpublished, then publishes `loopmd@X.Y.Z` to npm with provenance.

## Notes

- `prepack` rebuilds `dist/` before any `npm pack`/`npm publish`, so a publish can never ship a
  stale or broken bundle — locally or in CI.
- Provenance is only generated from **public** repositories.
- To publish manually (not recommended): `npm publish` from a clean `main` after `npm version`.
