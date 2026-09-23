import { money, when } from '@/lib/format';

export interface TimelineEvent {
  type: string;
  at: string;
  metadata: Record<string, unknown>;
}

const fare = (m: Record<string, unknown>, key: string) =>
  typeof m[key] === 'number' ? money(m[key] as number) : '';

// One sentence per ride_events row: the history that explains what happened.
export function describe(e: TimelineEvent, who?: string): string {
  const m = e.metadata ?? {};
  const subject = who ?? 'You';
  switch (e.type) {
    case 'RIDE_REQUESTED':
      return `${subject} requested ${m.seats ?? 1} seat(s)`;
    case 'RIDE_MATCHED':
      return `${who ? `${who} joined` : 'Matched with a Tesla'}${m.via === 'AUTO_JOIN' ? ' (auto-joined an open pool)' : m.via === 'SWEEP' ? ' (pulled in by the driver)' : ''}`;
    case 'RIDE_UNMATCHED':
      return `${who ? `${who} returned` : 'Driver cancelled; you are back'} in the waiting queue`;
    case 'RIDE_CANCELLED':
      return `${subject} cancelled`;
    case 'POOL_CREATED':
      return 'Driver accepted and opened the pool';
    case 'POOL_DRIVER_ARRIVED':
      return 'Driver arrived at pickup';
    case 'POOL_STARTED':
      return 'Trip started';
    case 'FARE_LOCKED':
      return `Fare locked at ${fare(m, 'finalFarePaisa')}${m.pooled ? ' (pooled discount)' : ''}${who ? ` for ${who}` : ''}`;
    case 'POOL_COMPLETED':
      return 'Trip completed';
    case 'PAYMENT_SETTLED':
      return m.status === 'PENDING'
        ? `TeslaPay balance short: ${fare(m, 'farePaisa')} cash due${who ? ` from ${who}` : ''}`
        : `${fare(m, 'farePaisa')} paid ${m.method === 'CASH' ? 'in cash' : 'via TeslaPay'}${who ? ` by ${who}` : ''}`;
    case 'POOL_CANCELLED':
      return m.reason === 'EMPTY'
        ? 'Pool cancelled automatically: no passengers left'
        : 'Driver cancelled the pool';
    default:
      return e.type;
  }
}

export function Timeline({
  events,
  nameOf,
}: {
  events: (TimelineEvent & { rideId?: string | null })[];
  nameOf?: (rideId: string) => string | undefined;
}) {
  return (
    <ol className="relative space-y-3 border-l pl-4">
      {events.map((e, i) => (
        <li key={i} className="text-sm">
          <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border bg-background" aria-hidden />
          <p>{describe(e, e.rideId ? nameOf?.(e.rideId) : undefined)}</p>
          <p className="text-xs text-muted-foreground">{when(e.at)}</p>
        </li>
      ))}
    </ol>
  );
}
