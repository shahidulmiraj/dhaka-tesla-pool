'use client';

import { useZones } from '@/features/rides/queries';

export function ZoneSelect({ value, onChange }: { value: number; onChange: (id: number) => void }) {
  const zones = useZones();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Serving</span>
      <select
        aria-label="Pickup zone you serve"
        className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        value={value || ''}
        disabled={!zones.data}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {!value && <option value="">Choose zone</option>}
        {zones.data?.map((z) => (
          <option key={z.id} value={z.id}>
            {z.name}
          </option>
        ))}
      </select>
    </label>
  );
}
