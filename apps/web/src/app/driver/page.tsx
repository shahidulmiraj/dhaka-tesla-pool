'use client';

import { useRouter } from 'next/navigation';
import { AsyncState } from '@/components/AsyncState';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/features/auth/useMe';
import { ActivePoolCard } from '@/features/driver/ActivePoolCard';
import { AvailabilityToggle } from '@/features/driver/AvailabilityToggle';
import { OpenRequestList } from '@/features/driver/OpenRequestList';
import { useActivePool, useSetServingZone } from '@/features/driver/queries';
import { ZoneSelect } from '@/features/driver/ZoneSelect';

export default function DriverDashboard() {
  const router = useRouter();
  const me = useMe();
  const active = useActivePool();
  const setZone = useSetServingZone();
  // Stored on the server: completing a trip moves it to the last drop-off.
  const zoneId = me.data?.servingZone?.id ?? 0;
  const zoneName = me.data?.servingZone?.name ?? '';
  const online = !!me.data?.isOnline;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-3">
          <ZoneSelect value={zoneId} onChange={(id) => setZone.mutate(id)} />
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
              onAccepted={(id) => router.push(`/driver/pools/${id}`)}
            />
          )
        }
      </AsyncState>
    </section>
  );
}
