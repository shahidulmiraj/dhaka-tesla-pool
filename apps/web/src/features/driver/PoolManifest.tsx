import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { paymentLabel } from '@/features/rides/payment';
import { money } from '@/lib/format';
import type { PoolMember } from './types';

export function PoolManifest({ members }: { members: PoolMember[] }) {
  if (members.length === 0)
    return <p className="text-sm text-muted-foreground">No passengers in this pool.</p>;
  return (
    <ul className="divide-y rounded-xl border">
      {members.map((m) => (
        <li key={m.rideId} className="flex flex-wrap items-center justify-between gap-3 p-3">
          <div>
            <p className="font-medium">{m.passengerName}</p>
            <p className="text-sm text-muted-foreground">
              {m.seats} seat(s) · drop at {m.dropoffZone}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 text-sm">
            <span>
              {money(m.farePaisa)}{' '}
              <span className="text-xs text-muted-foreground">{m.fareIsFinal ? 'final' : 'estimate'}</span>
            </span>
            <div className="flex gap-1">
              <StatusBadge status={m.status} />
              <Badge variant={m.paymentStatus === 'PENDING' ? 'destructive' : 'outline'}>
                {paymentLabel(m.paymentMethod, m.paymentStatus)}
              </Badge>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
