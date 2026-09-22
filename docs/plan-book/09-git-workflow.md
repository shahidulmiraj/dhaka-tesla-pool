# 09 — Git Workflow and Commit Plan

The PRD says process is "a major, explicit part of the score" and that a perfect repo with a meaningless history is weaker than a smaller one with a real journey. Follow this exactly.

## Required branches

| Branch | Purpose | Lifetime |
|---|---|---|
| `master` | Integration branch; default on GitHub | permanent |
| `feature/*` | One logical feature each; merged into `master` with `--no-ff` | short |
| `pre-release` | Cut from `master` after all features; integration fixes, docs, deployment checks | permanent |
| `release/v1.0.0` | Cut from `pre-release`; the version shown in the video and deployed | permanent, tagged `v1.0.0` |

## Day 1 setup (first 30 minutes)

```bash
mkdir dhaka-tesla-pool && cd dhaka-tesla-pool
git init -b master
printf 'node_modules/\n.env\n.env.local\n.env.*.local\ndist/\n.next/\ncoverage/\n' > .gitignore
git add .gitignore && git commit -m "chore: add gitignore"
gh repo create <user>/dhaka-tesla-pool --public --source=. --push
gh repo edit --default-branch master          # if GitHub created main
```

GitHub → Settings → General → Pull Requests: **enable only "Allow merge commits"**; disable squash and rebase merging. That way the UI cannot flatten history by accident.

Merging: either open a PR and merge (merge commit), or locally `git checkout master && git merge --no-ff feature/x && git push`. Identical graph. Use PRs when the branch deserves a paragraph (pooling, docker); local merges for the rest.

## Commit message rules

`<type>(<scope>): <imperative short description>` where type ∈ `feat fix refactor test docs chore build` and scope ∈ `api web db auth rides pools fare docker ci docs` (or omitted for repo-wide).

Good: `feat(pools): enforce Bullet seat capacity with conditional update`
Bad: `update`, `fix stuff`, `final`, `working now`, `wip`, `asdf`, `feat: everything`

One commit = one understandable change. A commit that touches the schema, the service, and the test for the same rule is one change. A commit that adds auth and the driver dashboard is two.

Add `Co-Authored-By: Claude <noreply@anthropic.com>` (or the tool you used) as a trailer on AI-drafted commits and say so in the README AI section. Honest beats suspicious.

## Branch order and commit plan

Realistic 3–8 commits each. Adjust wording to what you actually did; do not invent commits for work that did not happen.

### 1. `feature/monorepo-scaffold` (Day 1)
```
chore: init pnpm workspace with apps/api and apps/web
chore(api): scaffold NestJS 11 app with health endpoint and pino logging
chore(web): scaffold Next.js app with Tailwind and shadcn/ui
chore: add prettier, eslint and editorconfig
docs: add README skeleton with problem statement and stack
```

### 2. `feature/database-schema` (Day 1)
```
feat(db): add Prisma schema for users, vehicles, zones, ride requests, pools and events
feat(db): add initial migration with capacity CHECK and active-ride unique indexes
feat(api): add PrismaModule with shutdown hook
feat(db): add idempotent seed with Jashim, Bullet, Nusrat, Rafiq, Shirin and Dhaka zones
docs(db): add ERD and table explanations
```

### 3. `feature/auth` (Day 2)
```
feat(auth): add signup and login with bcrypt and JWT
feat(auth): add JwtAuthGuard, RolesGuard and CurrentUser decorator
feat(auth): add GET /auth/me with vehicle for drivers
feat(api): add domain exception filter with error codes
test(auth): add signup, login and role guard e2e tests
```

### 4. `feature/fare` (Day 2)
```
feat(fare): add haversine distance and paisa fare calculator
feat(fare): add GET /fare/estimate with solo and pooled quotes
test(fare): verify Nusrat and Rafiq fares by hand-checked numbers
```

### 5. `feature/ride-requests` (Day 2)
```
feat(rides): add POST /rides with distance and fare quote
feat(rides): add passenger ride list, active and detail with events
feat(rides): add passenger cancel with transition table
test(rides): add ride lifecycle and ownership e2e tests
```

### 6. `feature/pooling` (Day 3)
```
feat(pools): add driver online/offline with vehicle and active-pool checks
feat(pools): add joinPool with conditional seat update as the single membership writer
feat(pools): add driver accept that creates a pool and sweeps compatible requests
feat(rides): auto-join compatible open pool on request creation
feat(pools): add arrive, start and complete with member cascades and fare lock
feat(pools): add driver cancel reverting members and auto-cancel of empty pools
feat(pools): settle TeslaPay wallet or mark cash due on completion
test(pools): add capacity, transition, cancellation and concurrency e2e tests
```
If the race test fails on first try (it might), the fix commit is a real, valuable line: `fix(pools): re-check seats in the same UPDATE to close the overbooking window`.

### 7. `feature/web-auth` (Day 4)
```
feat(web): add api client with bearer token and 401 handling
feat(web): add login and register pages
feat(web): add RequireRole guard and role-based root redirect
feat(web): add cold-start banner driven by health endpoint
```

### 8. `feature/web-passenger` (Day 4)
```
feat(web): add request ride form with zone selects and fare preview
feat(web): add ride status card with 4 s polling until terminal
feat(web): add ride history and detail with event timeline
feat(web): add cancel ride action with confirmation
```

### 9. `feature/web-driver` (Day 5)
```
feat(web): add driver dashboard with availability toggle and zone select
feat(web): add open requests list with accept action
feat(web): add pool detail manifest with arrive, start, complete and cancel
fix(web): invalidate pool queries after member cancellation
```

### 10. `feature/docker` (Day 3 for API, Day 5 for web)
```
build(api): add multi-stage Dockerfile with migrate-and-seed entrypoint
build(web): add standalone Next.js Dockerfile with API url build arg
build: add docker compose with healthchecks and test database init
docs: add local, docker and test instructions
```
It is fine for this branch to be created on Day 3, merged with the API half, and a second `feature/docker-web` branch to follow on Day 5. Two branches beats one long-lived one.

### 11. `feature/scale-notes` (Day 5)
```
docs: add viral-scale reasoning with architecture diagram
```

### `pre-release` (Day 6)
```bash
git checkout master && git pull
git checkout -b pre-release && git push -u origin pre-release
```
Direct commits on `pre-release`, each real:
```
build(api): bind to PORT and 0.0.0.0 for Render
fix(api): allow Vercel origin in CORS
docs: add deployment URLs, cold-start note and demo credentials
docs: add screenshots and GIFs from the deployed app
docs: add AI usage section
docs: add architecture diagram to README
```
Point Render and Vercel at `pre-release`. Fix what breaks, commit each fix. Then merge back: `git checkout master && git merge --no-ff pre-release && git push`.

### `release/v1.0.0` (Day 7)
```bash
git checkout pre-release && git pull
# after the video is uploaded:
git commit -am "docs: add demo video link"          # on pre-release
git checkout -b release/v1.0.0
git tag -a v1.0.0 -m "Dhaka Tesla Pool v1.0.0"
git push -u origin release/v1.0.0 --tags
git checkout master && git merge --no-ff release/v1.0.0 && git push
```
Switch Render and Vercel production branch to `release/v1.0.0`. The README's deployment URL must serve this branch.

## Daily hygiene

- Commit as you go, after each logical unit. Never end a Claude Code session with one `git add -A && git commit`.
- Use `git add -p` when the AI changed more than one thing.
- Do not amend pushed commits, do not rebase shared branches, do not rewrite dates, do not squash at the end.
- Check: `git log --first-parent --oneline master`. After the scaffold commits, every line should be a merge commit. Anything else is a feature pushed straight to `master`.
- Check: `git log --all --diff-filter=A --name-only --pretty=format: | sort -u | grep -Ei '(^|/)\.env$|node_modules/'` must print nothing.

## What evaluators catch

| Smell | Avoid by |
|---|---|
| Single giant initial commit | Scaffold branch with 4–5 commits, then feature branches |
| All commits timestamped the last evening | Commit during the day, every day |
| `pre-release` with zero commits | Real deploy fixes and docs land there |
| Missing tag or `release/*` branch | Day 7 checklist |
| Squash merges hiding branch work | Disable squash in GitHub settings |
| `.env` or secrets in history | `.gitignore` before the first commit; `openssl rand` secrets never pasted into tracked files |
| Commit messages that do not match the diff | Write the message after `git diff --staged` |
| Generic placeholder users in seed or tests | The cast |
| README screenshots as broken links | Commit images under `docs/screenshots/` and reference relative paths |
