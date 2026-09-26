'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AsyncState } from '@/components/AsyncState';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/features/auth/useMe';
import { ActivePoolCard } from '@/features/driver/ActivePoolCard';
import { AvailabilityToggle } from '@/features/driver/AvailabilityToggle';
import { DestinationSelect } from '@/features/driver/DestinationSelect';
import { OpenRequestList } from '@/features/driver/OpenRequestList';
import { useActivePool } from '@/features/driver/queries';
import { readServingZone, writeServingZone } from '@/features/driver/servingZone';
import { ZoneSelect } from '@/features/driver/ZoneSelect';
import { useZones } from '@/features/rides/queries';

export default function DriverDashboard() {
  const router = useRouter();
  const me = useMe();
  const zones = useZones();
  const active = useActivePool();
  // Safe to read localStorage here: RequireRole renders this page only in the browser.
  const [zoneId, setZoneId] = useState(() => readServingZone());
  const [destinationZoneId, setDestinationZoneId] = useState<number | undefined>(undefined);

  const chooseZone = (id: number) => {
    writeServingZone(id);
    setZoneId(id);
    if (destinationZoneId === id) {
      setDestinationZoneId(undefined);
    }
  };
  const zoneName = zones.data?.find((z) => z.id === zoneId)?.name ?? '';
  const destinationZoneName = zones.data?.find((z) => z.id === destinationZoneId)?.name;
  const online = !!me.data?.isOnline;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-3">
          <ZoneSelect value={zoneId} onChange={chooseZone} />
          <DestinationSelect
            pickupZoneId={zoneId}
            value={destinationZoneId}
            onChange={setDestinationZoneId}
          />
          <AvailabilityToggle online={online} />
        </div>
      </div>
      <AsyncState query={active} skeleton={<Skeleton className="h-48 w-full" />}>
        {(pool) =>
          pool ? (
            <ActivePoolCard pool={pool} />
          ) : !online ? (
            <EmptyState title="You are offline" hint="Go online to see passengers waiting in your zone." />
          ) : !zoneId ? (
            <EmptyState title="Choose the zone you are serving" hint="You will see requests waiting there." />
          ) : (
            <OpenRequestList
              zoneId={zoneId}
              zoneName={zoneName}
              destinationZoneId={destinationZoneId}
              destinationZoneName={destinationZoneName}
              onSelectDestination={setDestinationZoneId}
              onClearDestination={() => setDestinationZoneId(undefined)}
              onAccepted={(id) => router.push(`/driver/pools/${id}`)}
            />
          )
        }
      </AsyncState>
    </section>
  );
}
