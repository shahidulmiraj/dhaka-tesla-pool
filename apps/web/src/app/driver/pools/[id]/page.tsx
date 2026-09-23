'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AsyncState } from '@/components/AsyncState';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { Timeline } from '@/components/Timeline';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PoolActions } from '@/features/driver/PoolActions';
import { PoolManifest } from '@/features/driver/PoolManifest';
import { usePool } from '@/features/driver/queries';
import { SeatMeter } from '@/features/driver/SeatMeter';
import { ApiError } from '@/lib/api-client';
import { money, when } from '@/lib/format';

export default function PoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const pool = usePool(id);
  return (
    <AsyncState
      query={pool}
      skeleton={<Skeleton className="h-96 w-full" />}
      errorFallback={(e) =>
        e instanceof ApiError && (e.status === 403 || e.status === 404 || e.status === 400) ? (
          <EmptyState
            title="This pool isn't yours"
            action={
              <Link href="/driver" className={buttonVariants()}>
                Back to dashboard
              </Link>
            }
          />
        ) : undefined
      }
    >
      {(p) => {
        // Names for timeline rows; members who left are no longer listed.
        const names = Object.fromEntries(p.members.map((m) => [m.rideId, m.passengerName.split(' ')[0]]));
        const cashDue = p.members.filter(
          (m) => m.paymentStatus === 'PENDING' || (m.paymentMethod === 'CASH' && p.status !== 'COMPLETED'),
        );
        return (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>
                  {p.vehicleName} from {p.pickupZone.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground">Opened {when(p.createdAt)}</p>
              </div>
              <StatusBadge status={p.status} />
            </CardHeader>
            <CardContent className="space-y-5">
              <SeatMeter taken={p.seatsTaken} capacity={p.capacity} vehicle={p.vehicleName} />
              <PoolManifest members={p.members} />
              {cashDue.length > 0 && (
                <p className="text-sm">
                  Cash to collect:{' '}
                  <span className="font-medium">
                    {money(cashDue.reduce((sum, m) => sum + m.farePaisa, 0))}
                  </span>{' '}
                  from {cashDue.map((m) => m.passengerName.split(' ')[0]).join(', ')}
                </p>
              )}
              <PoolActions poolId={p.id} status={p.status} />
              <div className="space-y-2">
                <h2 className="text-sm font-medium">What happened</h2>
                <Timeline events={p.events} nameOf={(rideId) => names[rideId] ?? 'A passenger'} />
              </div>
            </CardContent>
          </Card>
        );
      }}
    </AsyncState>
  );
}
