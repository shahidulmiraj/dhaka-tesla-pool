'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AsyncState } from '@/components/AsyncState';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { StatusStepper } from '@/components/StatusStepper';
import { Timeline } from '@/components/Timeline';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CancelRideButton } from '@/features/rides/CancelRideButton';
import { FareBlock } from '@/features/rides/FareBlock';
import { useRide } from '@/features/rides/queries';
import { ApiError } from '@/lib/api-client';
import { km, when } from '@/lib/format';
import { PASSENGER_CAN_CANCEL } from '@/lib/status';

export default function RideDetailPage() {
  const { id } = useParams<{ id: string }>();
  const ride = useRide(id);
  return (
    <AsyncState
      query={ride}
      skeleton={<Skeleton className="h-96 w-full" />}
      errorFallback={(e) =>
        e instanceof ApiError && (e.status === 403 || e.status === 404 || e.status === 400) ? (
          <EmptyState
            title="This ride isn't yours"
            hint="It may belong to someone else or no longer exist."
            action={
              <Link href="/passenger" className={buttonVariants()}>
                Back home
              </Link>
            }
          />
        ) : undefined
      }
    >
      {(r) => (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>
                {r.pickupZone.name} → {r.dropoffZone.name}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {when(r.createdAt)} · {r.seats} seat(s) · {km(r.distanceM)}
              </p>
            </div>
            <StatusBadge status={r.status} />
          </CardHeader>
          <CardContent className="space-y-5">
            {r.status !== 'CANCELLED' && <StatusStepper status={r.status} />}
            {r.pool && (
              <p className="text-sm">
                Driver <span className="font-medium">{r.pool.driverName}</span> · {r.pool.vehicleName} ·{' '}
                {r.pool.coPassengers} co-passenger(s)
              </p>
            )}
            <FareBlock ride={r} />
            {PASSENGER_CAN_CANCEL.includes(r.status) && <CancelRideButton rideId={r.id} matched={!!r.pool} />}
            <div className="space-y-2">
              <h2 className="text-sm font-medium">What happened</h2>
              <Timeline events={r.events} />
            </div>
          </CardContent>
        </Card>
      )}
    </AsyncState>
  );
}
