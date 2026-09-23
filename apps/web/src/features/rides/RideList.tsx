import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';
import { money, when } from '@/lib/format';
import type { RideSummary } from './types';

export function RideList({ rides }: { rides: RideSummary[] }) {
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {rides.map((r) => (
        <li key={r.id}>
          <Link
            href={`/passenger/rides/${r.id}`}
            className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50"
          >
            <div>
              <p className="font-medium">
                {r.pickupZone.name} → {r.dropoffZone.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {when(r.createdAt)} · {r.seats} seat(s)
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusBadge status={r.status} />
              <span className="text-sm">
                {r.status === 'CANCELLED'
                  ? '—'
                  : r.fareIsFinal
                    ? money(r.farePaisa)
                    : `up to ${money(r.farePaisa)}`}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
