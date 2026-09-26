'use client';

import { useZones } from '@/features/rides/queries';

export function DestinationSelect({
  pickupZoneId,
  value,
  onChange,
}: {
  pickupZoneId?: number;
  value?: number;
  onChange: (id: number | undefined) => void;
}) {
  const zones = useZones();
  const availableZones = zones.data?.filter((z) => !pickupZoneId || z.id !== pickupZoneId);

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Going to</span>
      <select
        aria-label="Dropoff destination filter"
        className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        value={value ?? ''}
        disabled={!zones.data}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val ? Number(val) : undefined);
        }}
      >
        <option value="">All destinations</option>
        {availableZones?.map((z) => (
          <option key={z.id} value={z.id}>
            {z.name}
          </option>
        ))}
      </select>
    </label>
  );
}
