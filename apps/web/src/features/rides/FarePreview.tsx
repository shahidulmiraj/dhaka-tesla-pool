'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { km, money } from '@/lib/format';
import { useFareEstimate } from './queries';

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function FarePreview({
  pickupZoneId,
  dropoffZoneId,
  seats,
}: {
  pickupZoneId: number;
  dropoffZoneId: number;
  seats: number;
}) {
  const params = useDebounced(
    pickupZoneId && dropoffZoneId ? { pickupZoneId, dropoffZoneId, seats } : null,
    300,
  );
  const estimate = useFareEstimate(params);

  if (!params)
    return <p className="text-sm text-muted-foreground">Choose pickup and destination to see the fare.</p>;
  if (params.pickupZoneId === params.dropoffZoneId)
    return <p className="text-sm text-destructive">Pickup and destination must be different zones.</p>;
  if (estimate.isPending) return <Skeleton className="h-12 w-full" />;
  if (estimate.isError) return <p className="text-sm text-destructive">{estimate.error.message}</p>;

  const e = estimate.data;
  return (
    <div className="rounded-lg bg-muted/60 p-3" aria-live="polite">
      <p className="font-medium">
        Up to {money(e.soloFarePaisa)} ·{' '}
        <span className="text-primary">{money(e.pooledFarePaisa)} if pooled</span>
      </p>
      <p className="text-xs text-muted-foreground">
        {km(e.distanceM)} · base {money(e.breakdown.baseFarePaisa)} + distance{' '}
        {money(e.breakdown.distanceChargePaisa)} − pool discount {money(e.breakdown.poolDiscountPaisa)}
        {e.seats > 1 && `, × ${e.seats} seats`}. Final fare locks when the trip starts.
      </p>
    </div>
  );
}
