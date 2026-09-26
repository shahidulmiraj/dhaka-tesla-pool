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
  if (estimate.isPending) return <Skeleton className="h-20 w-full" />;
  if (estimate.isError) return <p className="text-sm text-destructive">{estimate.error.message}</p>;

  const e = estimate.data;
  return (
    <div className="rounded-lg bg-muted/60 p-3 space-y-2" aria-live="polite">
      {/* Three-tier fare grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md bg-background/70 p-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Solo</p>
          <p className="font-semibold text-sm">{money(e.soloFarePaisa)}</p>
        </div>
        <div className="rounded-md bg-primary/8 border border-primary/20 p-2">
          <p className="text-[10px] uppercase tracking-wide text-primary font-medium">3 pooled · 30% off</p>
          <p className="font-semibold text-sm text-primary">{money(e.pooled3FarePaisa)}</p>
        </div>
        <div className="rounded-md bg-green-500/8 border border-green-500/20 p-2">
          <p className="text-[10px] uppercase tracking-wide text-green-600 dark:text-green-400 font-medium">5+ pooled · 50% off</p>
          <p className="font-semibold text-sm text-green-600 dark:text-green-400">{money(e.pooledMaxFarePaisa)}</p>
        </div>
      </div>

      {/* Breakdown caption */}
      <p className="text-xs text-muted-foreground">
        {km(e.distanceM)} · base {money(e.breakdown.baseFarePaisa)} + distance {money(e.breakdown.distanceChargePaisa)}
        {seats > 1 && `, × ${seats} seats`}. Final fare locks when the trip starts.
      </p>
    </div>
  );
}

