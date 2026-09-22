# 06 — Frontend Design

Seven screens plus a root redirect. Simple and clean is enough; correct states matter more than visuals. No map library.

## Route map (App Router)

```
apps/web/src/app/
  layout.tsx                        server; metadata; renders <Providers> (client: QueryClientProvider, Toaster) and <ColdStartBanner>
  page.tsx                          client; redirect by auth state → /login | /passenger | /driver
  login/page.tsx                    LoginForm; link to register; demo credentials hint in dev
  register/page.tsx                 RegisterForm; role select; driver shows vehicle name + capacity (default "Bullet", 3)
  passenger/layout.tsx              client; <RequireRole role="PASSENGER"> + AppShell (nav: Request, My rides, Sign out)
  passenger/page.tsx                if active ride → <RideStatusCard> else <RequestRideForm>
  passenger/rides/page.tsx          history list; EmptyState "No rides yet — request your first Tesla"
  passenger/rides/[id]/page.tsx     RideDetail: StatusBadge, timeline, driver/vehicle, fare block, Cancel button (when allowed)
  driver/layout.tsx                 client; <RequireRole role="DRIVER"> + AppShell (nav: Dashboard, History, Sign out)
  driver/page.tsx                   AvailabilityToggle + ZoneSelect; if active pool → ActivePoolCard (link) else OpenRequestList with Accept
  driver/pools/page.tsx             history list
  driver/pools/[id]/page.tsx        PoolDetail: seats "2 / 3", member manifest, action bar (Arrive → Start → Complete; Cancel while allowed)
```

That is `/`, `/login`, `/register`, `/passenger`, `/passenger/rides`, `/passenger/rides/[id]`, `/driver`, `/driver/pools`, `/driver/pools/[id]`. Nothing else: no profile, no settings, no admin, no map.

## Screens and their states

| Screen | Loading | Error | Empty | Notes |
|---|---|---|---|---|
| Login / Register | button spinner, fields disabled | inline `Alert` with API message | — | Register: capacity field `1..6`; role radio |
| Passenger home (form) | zones `Skeleton` | Alert + Retry | — | Fare preview calls `/fare/estimate` on change (debounced 300 ms): "Up to 57.36 BDT · 51.89 BDT if pooled" |
| Passenger home (active ride) | card skeleton | Alert + Retry | — | Polls every 4 s; shows status stepper, driver "Jashim · Bullet" once matched, co-passenger count, Cancel |
| Ride history | 3 skeleton rows | Alert + Retry | EmptyState with CTA to request | Each row: zones, date (locale), status badge, fare |
| Ride detail | skeleton | Alert + Retry; 403/404 → "This ride isn't yours" with link home | — | Timeline from `events`; final fare block after start; payment status after completion |
| Driver dashboard | toggle disabled + skeleton | Alert + Retry | "No one is waiting in Banani right now" | Zone select persisted in `localStorage`; Accept disabled when offline; list polls every 4 s while online |
| Pool detail | skeleton | Alert + Retry | — | Seats "3 / 3 — Bullet is full"; action buttons enabled per `POOL_TRANSITIONS`; each member row: name, seats, dropoff, fare, payment badge |

Status stepper for passenger: Waiting → Matched → Driver arrived → In progress → Completed, with Cancelled rendered as a red terminal chip. Map statuses to labels in one `statusLabel()` helper.

## Auth state

- Token in `localStorage['tp_token']`. Set on login/register, cleared on sign out or any `401`.
- `lib/api-client.ts`: one `api<T>(path, init)` wrapper. Adds base URL and `Authorization`, parses JSON, throws `ApiError { status, code, message }`. On `401` clears the token and calls `location.assign('/login')`.
- `features/auth/useMe.ts`: `useQuery({ queryKey: ['me'], queryFn: () => api('/auth/me'), enabled: hasToken, staleTime: Infinity, retry: false })`. Role comes from here, never decoded from the JWT in the browser.
- `RequireRole` (client component, used in the two role layouts):

```tsx
'use client';
export function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const router = useRouter();
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  useEffect(() => { setHasToken(!!readToken()); }, []);           // never read localStorage during render
  const me = useMe(hasToken === true);
  useEffect(() => {
    if (hasToken === false) router.replace('/login');
    else if (me.data && me.data.role !== role) router.replace(`/${me.data.role.toLowerCase()}`);
  }, [hasToken, me.data, role, router]);
  if (hasToken !== true || !me.data || me.data.role !== role) return <CenteredSpinner />;
  return <>{children}</>;
}
```

No Next middleware, no cookies, no server components reading auth. Reason (also the README "rejected suggestion"): the token is not in a cookie, and a cross-site cookie between Vercel and Render would need `SameSite=None`, CORS credentials, CSRF protection, and still breaks under Safari's tracking prevention.

## Data layer conventions

- One `queries.ts` per feature exporting hooks: `useActiveRide()`, `useRide(id)`, `useRides()`, `useZones()`, `useFareEstimate(params)`, `useDriverRequests(zoneId, enabled)`, `useActivePool()`, `usePool(id)`, `usePools()`.
- Query keys are arrays: `['rides', 'active']`, `['rides', id]`, `['driver', 'pools', id]`.
- Mutations invalidate the smallest set that changes: after `cancel` → `['rides']`; after any pool action → `['driver']`.
- Polling: `refetchInterval: (q) => isTerminal(q.state.data?.status) ? false : 4000`, `refetchIntervalInBackground: false`. Say in the video that polling stops on terminal states.
- No optimistic updates. The server is the source of truth for state machines; a 409 must show its message.

## `AsyncState` component (the loading/error/empty rubric in one place)

```tsx
<AsyncState query={ridesQuery} empty={<EmptyState title="No rides yet" action={<Link href="/passenger">Request a ride</Link>} />} isEmpty={(d) => d.items.length === 0}>
  {(data) => <RideList rides={data.items} />}
</AsyncState>
```

- `isPending` → `Skeleton` rows (pass `skeleton` prop for shape)
- `isError` → `Alert variant="destructive"` with `error.message` and a Retry button calling `refetch()`
- empty → the `empty` prop
- else → children render prop

Mutations: `disabled={isPending}`, spinner inside the button, `sonner` toast on error with `ApiError.message`, toast on success for state changes ("Bullet is on its way").

## Cold-start banner

```tsx
const health = useQuery({ queryKey: ['health'], queryFn: () => api('/health', { base: 'root' }), retry: 10, retryDelay: 3000, staleTime: 60_000 });
if (health.isPending && health.failureCount > 0) return <Banner>Waking up the API (free-tier cold start, up to 60 s)…</Banner>;
```

Rendered once in the root layout. Cheapest honest fix for Render's sleep.

## Component organisation

```
src/
  app/                       routes only; page files are thin
  components/
    ui/                      shadcn generated (button, input, select, card, badge, alert, skeleton, dialog, sonner) — do not edit
    AppShell.tsx             header, nav by role, sign-out
    AsyncState.tsx  EmptyState.tsx  StatusBadge.tsx  StatusStepper.tsx  ColdStartBanner.tsx  Money.tsx  DateTime.tsx
  features/
    auth/      LoginForm.tsx RegisterForm.tsx RequireRole.tsx useMe.ts api.ts types.ts
    rides/     RequestRideForm.tsx FarePreview.tsx RideStatusCard.tsx RideTimeline.tsx RideList.tsx queries.ts api.ts types.ts
    driver/    AvailabilityToggle.tsx ZoneSelect.tsx OpenRequestList.tsx ActivePoolCard.tsx PoolManifest.tsx PoolActions.tsx queries.ts api.ts types.ts
  lib/
    api-client.ts  query-client.ts  format.ts (Intl money/date)  status.ts (labels, isTerminal, allowed actions)
```

`format.ts`:

```ts
export const money = (paisa: number, locale = navigator.language) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'BDT' }).format(paisa / 100);
export const when = (iso: string, locale = navigator.language) =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' }).format(new Date(iso));
```

Never hardcode separators or `DD.MM.YYYY`.

## Accessibility basics (cheap, expected)

Labels on every input, `aria-live="polite"` on the status card so a screen reader hears "Driver arrived", buttons not divs, focus-visible from shadcn defaults, colour plus text on badges (never colour alone).

## App Router pitfalls

| Pitfall | Rule |
|---|---|
| `localStorage` during render → hydration mismatch | Read only in `useEffect` or inside query functions |
| `'use client'` in `app/layout.tsx` | Not allowed with `metadata`; put it in `Providers.tsx` |
| `NEXT_PUBLIC_API_URL` baked at build | Set on Vercel before first deploy; Docker build `ARG`; browser calls `http://localhost:3001`, never `http://api:3001` |
| Standalone output in a pnpm monorepo | `next.config.ts`: `output: 'standalone'`, `outputFileTracingRoot: path.join(__dirname, '../../')` |
| `useSearchParams` needs Suspense | Not used; zone selection is local state |
| Next 16 renamed `middleware.ts` to `proxy.ts` | Irrelevant; we use neither |
| Turbopack build error on some dependency | `next build --webpack` is the escape hatch |
| Version drift in README | Copy versions from `package.json` at the end of Day 6 |

## Frontend tests

Skipped in the MVP and stated in the README: the risky logic is server-side and covered there; the UI is exercised in the video and by the e2e flows. Switch trigger: a second developer or a component with real logic (the stepper mapping is the only candidate; a 10-line Vitest test is optional if time remains on Day 5).
