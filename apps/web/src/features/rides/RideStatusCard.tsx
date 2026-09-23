'use client';

import Link from 'next/link';
import { AsyncState } from '@/components/AsyncState';
import { StatusStepper } from '@/components/StatusStepper';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { isTerminal, PASSENGER_CAN_CANCEL } from '@/lib/status';
import { CancelRideButton } from './CancelRideButton';
import { FareBlock } from './FareBlock';
import { useRide } from './queries';
import type { RideDetail } from './types';

const headline = (r: RideDetail) => {
  switch (r.status) {
    case 'REQUESTED':
      return 'Looking for a Tesla in ' + r.pickupZone.name + '…';
    case 'MATCHED':
      return `${r.pool!.vehicleName} is on its way`;
    case 'DRIVER_ARRIVED':
      return `${r.pool!.vehicleName} is waiting at ${r.pickupZone.name}`;
    case 'IN_PROGRESS':
      return `On the way to ${r.dropoffZone.name}`;
    case 'COMPLETED':
      return `Arrived at ${r.dropoffZone.name}`;
    case 'CANCELLED':
      return 'Ride cancelled';
  }
};

export function RideStatusCard({ rideId, onDone }: { rideId: string; onDone: () => void }) {
  const ride = useRide(rideId);
  return (
    <AsyncState query={ride} skeleton={<Skeleton className="h-72 w-full" />}>
      {(r) => (
        <Card>
          <CardHeader>
            <CardTitle aria-live="polite">{headline(r)}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {r.pickupZone.name} → {r.dropoffZone.name} · {r.seats} seat(s)
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatusStepper status={r.status} />
            {r.pool && (
              <p className="text-sm">
                <span className="font-medium">
                  {r.pool.driverName.split(' ')[0]} · {r.pool.vehicleName}
                </span>
                <span className="text-muted-foreground">
                  {' '}
                  ·{' '}
                  {r.pool.coPassengers === 0
                    ? 'no co-passengers yet'
                    : `${r.pool.coPassengers} co-passenger(s)`}
                </span>
              </p>
            )}
            <FareBlock ride={r} />
            <div className="flex flex-wrap gap-2">
              {PASSENGER_CAN_CANCEL.includes(r.status) && (
                <CancelRideButton rideId={r.id} matched={!!r.pool} />
              )}
              <Link href={`/passenger/rides/${r.id}`} className={buttonVariants({ variant: 'outline' })}>
                Details and history
              </Link>
              {isTerminal(r.status) && <Button onClick={onDone}>Request another ride</Button>}
            </div>
          </CardContent>
        </Card>
      )}
    </AsyncState>
  );
}
