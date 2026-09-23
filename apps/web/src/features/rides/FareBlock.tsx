import { money } from '@/lib/format';
import { paymentLabel } from './payment';
import type { RideDetail } from './types';

export function FareBlock({ ride }: { ride: RideDetail }) {
  return (
    <div className="rounded-lg bg-muted/60 p-3 text-sm">
      {ride.finalFarePaisa !== null ? (
        <p>
          <span className="font-medium">Your fare: {money(ride.finalFarePaisa)}</span>{' '}
          <span className="text-muted-foreground">(locked when the trip started)</span>
        </p>
      ) : ride.status === 'CANCELLED' ? (
        <p className="text-muted-foreground">
          No charge. Estimate was up to {money(ride.estimatedFarePaisa)}.
        </p>
      ) : (
        <p>
          <span className="font-medium">Up to {money(ride.estimatedFarePaisa)}</span> ·{' '}
          <span className="text-primary">{money(ride.pooledEstimatePaisa)} if pooled</span>
        </p>
      )}
      <p className="text-muted-foreground">{paymentLabel(ride.paymentMethod, ride.paymentStatus)}</p>
    </div>
  );
}
