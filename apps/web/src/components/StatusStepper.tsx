import { CheckIcon } from 'lucide-react';
import { RIDE_STEPS, type RideStatus, statusLabel } from '@/lib/status';

// Waiting -> Matched -> Driver arrived -> In progress -> Completed; Cancelled is a red terminal chip.
export function StatusStepper({ status }: { status: RideStatus }) {
  if (status === 'CANCELLED') {
    return (
      <p className="inline-flex rounded-full bg-destructive/10 px-3 py-1 text-sm font-medium text-destructive">
        Cancelled
      </p>
    );
  }
  const current = RIDE_STEPS.indexOf(status);
  return (
    <ol className="flex flex-wrap gap-x-2 gap-y-2 text-xs sm:text-sm" aria-label="Ride progress">
      {RIDE_STEPS.map((s, i) => {
        const done = i < current || status === 'COMPLETED';
        const active = i === current && status !== 'COMPLETED';
        return (
          <li key={s} className="flex items-center gap-2" aria-current={active ? 'step' : undefined}>
            <span
              className={`flex size-6 items-center justify-center rounded-full border text-xs ${
                done
                  ? 'border-primary bg-primary text-primary-foreground'
                  : active
                    ? 'border-primary text-primary'
                    : 'text-muted-foreground'
              }`}
            >
              {done ? <CheckIcon className="size-3.5" aria-hidden /> : i + 1}
            </span>
            <span className={active ? 'font-medium' : 'text-muted-foreground'}>{statusLabel(s)}</span>
            {i < RIDE_STEPS.length - 1 && <span className="hidden h-px w-4 bg-border sm:block" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
