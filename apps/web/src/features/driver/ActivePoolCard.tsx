import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SeatMeter } from './SeatMeter';
import type { PoolDetail } from './types';

export function ActivePoolCard({ pool }: { pool: PoolDetail }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <CardTitle>
          {pool.vehicleName} from {pool.pickupZone.name}
        </CardTitle>
        <StatusBadge status={pool.status} />
      </CardHeader>
      <CardContent className="space-y-4">
        <SeatMeter taken={pool.seatsTaken} capacity={pool.capacity} vehicle={pool.vehicleName} />
        <p className="text-sm text-muted-foreground">
          {pool.members.map((m) => `${m.passengerName.split(' ')[0]} → ${m.dropoffZone}`).join(' · ')}
        </p>
        <Link href={`/driver/pools/${pool.id}`} className={buttonVariants({ size: 'lg' })}>
          Open manifest
        </Link>
      </CardContent>
    </Card>
  );
}
