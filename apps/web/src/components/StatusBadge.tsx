import { Badge } from '@/components/ui/badge';
import { type PoolStatus, type RideStatus, statusLabel } from '@/lib/status';

// Colour plus text, never colour alone.
const TONE: Record<RideStatus | PoolStatus, string> = {
  REQUESTED: 'bg-amber-100 text-amber-900',
  OPEN: 'bg-sky-100 text-sky-900',
  MATCHED: 'bg-sky-100 text-sky-900',
  DRIVER_ARRIVED: 'bg-violet-100 text-violet-900',
  IN_PROGRESS: 'bg-primary/15 text-primary',
  COMPLETED: 'bg-emerald-100 text-emerald-900',
  CANCELLED: 'bg-destructive/10 text-destructive',
};

export function StatusBadge({ status }: { status: RideStatus | PoolStatus }) {
  return <Badge className={TONE[status]}>{statusLabel(status)}</Badge>;
}
