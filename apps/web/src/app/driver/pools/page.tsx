'use client';

import Link from 'next/link';
import { AsyncState } from '@/components/AsyncState';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { usePools } from '@/features/driver/queries';
import { when } from '@/lib/format';

export default function PoolHistoryPage() {
  const pools = usePools();
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Ride history</h1>
      <AsyncState
        query={pools}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title="No trips yet"
            hint="Accept a request from the dashboard to start your first pool."
          />
        }
      >
        {(d) => (
          <ul className="divide-y rounded-xl border bg-card">
            {d.items.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/driver/pools/${p.id}`}
                  className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium">
                      {p.vehicleName} from {p.pickupZone.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {when(p.createdAt)} · {p.memberCount} passenger(s) · {p.seatsTaken} / {p.capacity} seats
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </AsyncState>
    </section>
  );
}
