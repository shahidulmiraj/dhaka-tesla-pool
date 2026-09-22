# Start Here — How to Read and Implement This Plan Book

This is a guide to the guide. Read it first (10 minutes). It tells you what each document is for, in what order to read them, how to read them so the design becomes yours, and how to turn them into a repository, a deployment, a README, and a video in seven days.

## What this plan book is, and is not

**It is** a complete design for the Dhaka Tesla Pool MVP: stack decisions with reasons, architecture, schema, state machines, matching rule, fare model, API, frontend, Docker, hosting, tests, git plan, README and video outline, scaling reasoning, and interview answers. Every name in it (tables, statuses, endpoints, error codes, the cast) is meant to be used exactly as written so that code, tests, README, and video agree.

**It is not** code, and it is not something to paste into the submission repo wholesale. The evaluators score whether *you* understand what you shipped. The book gives you decisions and reasons; you must be able to say those reasons in your own words. If you cannot, the design is not yours yet, and the interview will show it.

**You may change anything.** The PRD invites assumptions and improvements. If you disagree with a rule here, change it, write down why in the README "Key decisions" section, and make code, tests, and docs agree with your new rule. A change you can defend beats a rule you cannot.

## Reading plan (about 3 hours total, before you write code)

Read in this order. After each document, close it and answer the checkpoint questions out loud. If you cannot, reread the relevant section. Do not skip to implementation with unanswered checkpoints; the later documents assume the earlier ones.

| Order | Doc | Time | Why you read it | Checkpoint: you can say without looking… |
|---|---|---|---|---|
| 1 | `00-plan-book.md` | 15 min | Map of the week, PRD checklist, the cast, the risks | The seven days in one sentence each. The five cast members and their trips. The biggest schedule risk and its mitigation |
| 2 | `04-domain-rules.md` | 45 min | **The heart.** Lifecycles, matching, fare, cancellation, payment, edge cases, the seat race. Every interview question comes from here | The two state machines. The five matching conditions. Nusrat's fare step by step. What happens when Nusrat and Shirin click at the same instant, and why zero rows come back for the loser. Why members revert to REQUESTED when a driver cancels |
| 3 | `03-database-design.md` | 30 min | Every table and column, and which invariants the database itself enforces | Why capacity is snapshotted on the pool. Why membership is a column, not a join table. Which two constraints Prisma cannot express and what you do about it. Why integer paisa |
| 4 | `02-architecture.md` | 15 min | The boxes, the two request flows, the folder layout, the layering rules | Trace Rafiq's request from browser to database in the auto-join case. What a controller never does |
| 5 | `05-api-design.md` | 15 min | Endpoints, error contract, guards | Which endpoints a passenger can call. What a 409 body looks like. Why 403 and not 404 for someone else's ride |
| 6 | `01-tech-stack.md` | 15 min | The "why this, why not that" for each choice; the README will quote it | Why NestJS. Why Prisma 6 not 7. Why REST. Why polling. Where the token lives and the trade-off |
| 7 | `09-git-workflow.md` | 15 min | The process you are scored on; you start it in the first 30 minutes of Day 1 | The four branch kinds and when each is cut. What `git log --first-parent master` should look like. Three commit-message anti-patterns |
| 8 | `08-testing-plan.md` | 15 min | The six behaviours the PRD demands proof of, and how each test proves it | Why the race test must hit real Postgres. What the race test asserts (hint: not 409) |
| 9 | `06-frontend-design.md` | 15 min | The nine routes, the one component that handles loading/error/empty, the auth guard | Why the token is read in an effect and never during render. When polling stops |
| 10 | `07-docker-and-deploy.md` | 15 min | Compose, images, the three env files, the hosting steps | Why the browser calls `localhost:3001` and not `api:3001`. What the API entrypoint does on boot. Which Neon URL goes where |
| 11 | `12-interview-prep.md` | 20 min now, again on Day 7 | Read the questions, not the answers, and try to answer. Where you cannot, go back to the doc | You answered at least 80 % without peeking |
| 12 | `10-readme-video-ai.md`, `11-viral-scale-bonus.md` | skim now, read on Day 5–6 | You need to know they exist and what they will need from you (screenshots, real AI examples, timings) | You know which README sections you write during the week rather than on Day 6 |

### How to read for ownership

- **Read for decisions, not for facts.** Every table row or bullet that says "because" is a decision. Keep a `decisions.md` file of your own (not committed, or committed to `docs/`; your call) with one line per decision in your own words: *"Fare locks at start because membership is frozen there; locking at complete gives the same number later and hides it during the ride."* Writing it is what makes it yours.
- **Argue with the book.** For each major decision ask: what would break if I did the opposite? If you cannot think of anything, you have not understood it yet. If you find something the book gets wrong, you have found a better answer; write it down and use it.
- **Do the arithmetic once by hand.** Compute Nusrat's and Rafiq's fares on paper from the coordinates in `03`. Compute the Mohakhali–Gulshan 1 distance. The evaluators will.
- **Draw the state machines from memory** on Day 2 before writing the transition table. Compare with `04`.
- **Say the concurrency answer aloud** until it takes under 45 seconds and uses the words "row lock", "re-evaluates the WHERE", "zero rows", "CHECK constraint".

## Implementation method

### The daily loop

```
morning   read the day's row in 00 and the docs it names (10 min)
          create the day's feature branch(es)
work      for each unit of work:
            1. open the exact doc section that specifies it
            2. write or generate the code against that section
            3. read every generated line; delete what you did not ask for
            4. write or run the test that proves the rule
            5. commit with a conventional message that matches the diff
evening   git log --first-parent --oneline master   (merges only after scaffold?)
          grep the code for drift from the doc names (see below)
          add today's "Key decisions" sentences to the README draft
          note one accepted and one rejected AI suggestion in a scratch file
```

Front-load integrity: Day 3's pooling and race test are the core. Nothing in the frontend is worth more than a passing race test. If Day 3 slips, take it from Day 5's polish, not from Day 3.

### Working with AI without losing ownership

The PRD allows AI and scores understanding. Rules that keep both:

1. **Spec in, code out.** Paste the relevant doc section into the prompt as the specification. Ask for exactly that, nothing more. Example prompt shapes are below.
2. **Never accept a file you have not read.** Read every generated file top to bottom before running it. Delete anything speculative (extra endpoints, helper abstractions, config for values that never change).
3. **Names are fixed.** If the AI renames `pools` to `trips`, `IN_PROGRESS` to `STARTED`, or `ride_events` to `audit_log`, reject the change. Consistency across code, tests, README, and video is worth more than any single improvement.
4. **The explain-back test.** After each generated unit, explain to yourself (or to Saiful) what it does and why it is shaped that way. If you cannot, ask the AI to explain it, then rewrite the explanation in your words. If you still cannot, simplify the code until you can.
5. **Write the tests yourself or read them harder than the code.** A test the AI wrote that passes may be testing nothing. Every test in `08` names what it asserts; check the assertion matches.
6. **Log accepted and rejected suggestions as they happen.** You need one of each, truthfully, for the README. You will get several during the week; the ones in `10` are predictions, replace them with what actually happened if it differs.
7. **Small prompts, small diffs, one commit each.** One module, one migration, one test file per prompt. Big prompts produce big diffs that you cannot review and cannot commit honestly.
8. **Do not let the AI touch git.** Branching, staging, and commit messages are yours; they are being scored.

### Prompt shapes that work

Adapt; keep them short and point at the doc.

**Scaffold**
> Create a NestJS 11 app in `apps/api` in this pnpm workspace with: `@nestjs/config` validating `DATABASE_URL, DIRECT_URL, JWT_SECRET, JWT_EXPIRES_IN, CORS_ORIGIN, PORT`; `nestjs-pino`; a `/health` controller returning `{status, db}` after `SELECT 1`; global prefix `api/v1` excluding `health`; `main.ts` as in this section: [paste `05` "Security in main.ts"]. No other modules yet.

**Schema and migration**
> Here is the Prisma schema sketch and the SQL that Prisma cannot generate: [paste from `03`]. Produce `schema.prisma` exactly matching it (Int for money and event ids), then run `prisma migrate dev --create-only --name init`, and append the SQL to the generated migration. Do not use `db push`.

**Service with rules**
> Implement `PoolsService.joinPool(tx, pool, request)` and `leavePool` following these rules: [paste `04` §2 "One function, two triggers" and §7 code block]. Use `updateMany` conditional updates inside the caller's `$transaction`. Return boolean. Record events via `EventsService.record(tx, …)`. No other methods in this step.

**Tests**
> Write `test/capacity-race.e2e-spec.ts` that does exactly this: [paste `08` §6 code and bullets]. Use the fixtures in `test/cast.ts`. Run against `TEST_DATABASE_URL`. Assert on `pool.id` membership count and `seatsTaken`, not on HTTP 409.

**Frontend feature**
> In `apps/web`, implement `features/rides/RideStatusCard.tsx` and its query hook per this spec: [paste the relevant rows of `06` "Screens and their states" and "Data layer conventions"]. Use the existing `AsyncState`, `StatusBadge`, `money`, `when` helpers. Polling 4 s until terminal. No optimistic updates.

**Docker**
> Create `apps/api/Dockerfile` and `docker-entrypoint.sh` exactly as in this section: [paste from `07`]. Then run `docker compose build api` and fix errors one at a time, telling me each change.

**README section**
> Using this table [paste from `01`], write the "Key decisions and trade-offs" README section in plain English, first person, no marketing tone, under 400 words.

### Drift check (run before each merge to master)

```bash
# statuses: anything not in the canonical set?
grep -rhoE "'(REQUESTED|MATCHED|DRIVER_ARRIVED|IN_PROGRESS|COMPLETED|CANCELLED|OPEN|STARTED|ACCEPTED|PENDING_MATCH)'" apps | sort | uniq -c
# table names in SQL/migrations
grep -rhoE '"(users|vehicles|zones|ride_requests|pools|ride_events|trips|stops|payments)"' apps/api/prisma | sort | uniq -c
# error codes
grep -rhoE "code: '[A-Z_]+'" apps/api/src | sort | uniq -c
# cast present, placeholders absent
grep -rniE 'user1|driver1|test@test|john doe' apps && echo "PLACEHOLDERS FOUND" || echo "cast ok"
```

Anything outside the sets in `03`, `04`, and `05` is drift. Fix it or update the doc, then the README.

### When you are stuck

- **Timebox: 45 minutes.** Then change approach: read the actual error, read the doc section again, search the official docs, ask the AI with the exact error text and the exact code, or take the fallback named in the doc (Alpine → `node:22-slim`, Turbopack → `--webpack`, Loom → OBS).
- **Reproduce before fixing.** For a failing test or a race, make it fail deterministically first. A fix without a reproduction is a guess.
- **Ask "what is the smallest change that makes the invariant hold?"** and make that change where all callers route through, not in one caller.
- **Write the problem down in one paragraph** before asking anyone. Half the time the paragraph is the answer.
- **If a feature will not fit, cut it cleanly.** Remove it from the UI, note it under "Known limitations", keep the tests that still pass. A smaller MVP with a clean process outscores a bigger one with a broken process; the PRD says so explicitly.

### When to deviate from the book

Deviate when you can say the sentence: *"The book says X; I did Y because Z; here is what changed in code, tests, and README."* Record it in your decisions file and in the README. Do not deviate silently, and do not deviate on names.

## Day-by-day: what to open

| Day | Open in the morning | Build | Prove before merging |
|---|---|---|---|
| 1 | `09` (setup), `02` (layout), `03` (schema, seed), `07` (compose db, Day-1 skeleton deploy) | scaffold, schema + migration, seed, `/health` live on Render | `docker compose up db` healthy; `/health` returns ok locally and on Render; branches and merge settings correct |
| 2 | `05` (auth, rides), `04` §3 (fare), `08` (auth, fare, rides tests) | auth, fare, ride requests | e2e for auth, fare numbers, ride lifecycle green |
| 3 | `04` §1, §2, §4, §5, §7 in full; `08` §1, §2, §5, §6; `07` (API image) | pooling, cascades, cancellation, settlement, race test, API Dockerfile | race test green 20 times; API container boots with migrate + seed |
| 4 | `06` (routes, auth, passenger screens) | web auth, passenger flow | Nusrat can sign in, see estimate, request, watch status change, cancel |
| 5 | `06` (driver screens), `07` (web image, clean-clone run), `11` | driver flow, web Dockerfile, full compose, scaling notes | fresh clone `docker compose up` works; whole story runs in the UI |
| 6 | `10` (README, screenshots), `07` (hosting to pre-release) | pre-release, live deploy, README, screenshots | every README section present; deployed app runs the story |
| 7 | `10` (video script), `12` (self-interview), `09` (release cut) | video, release/v1.0.0, tag, final checks | checklist in `10` all ticked; you answered `12` without notes |

## Before you submit: the ownership check

Sit with `12-interview-prep.md`, cover the answers, and answer each question aloud. Then do at least two of the live-change drills for real on a scratch branch (do not merge them). If any answer needs the book, that is the section to reread tonight. The bar the PRD sets is not "it runs". It is "I can explain, defend, and change it". This book gets you to the first; only your own reading and arguing gets you to the second.
