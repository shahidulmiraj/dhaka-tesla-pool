'use client';

import { Loader2Icon } from 'lucide-react';
import { AsyncState } from '@/components/AsyncState';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { when } from '@/lib/format';
import { useAccept, useDriverRequests } from './queries';

export function OpenRequestList({
  zoneId,
  zoneName,
  onAccepted,
}: {
  zoneId: number;
  zoneName: string;
  onAccepted: (poolId: string) => void;
}) {
  const requests = useDriverRequests(zoneId, true);
  const accept = useAccept(onAccepted);
  return (
    <AsyncState
      query={requests}
      isEmpty={(d) => d.length === 0}
      empty={
        <EmptyState
          title={`No one is waiting in ${zoneName} right now`}
          hint="This list refreshes every 4 seconds."
        />
      }
    >
      {(list) => (
        <ul className="divide-y rounded-xl border bg-card" aria-live="polite">
          {list.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium">
                  {r.passengerFirstName} → {r.dropoffZone.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {r.seats} seat(s) · requested {when(r.createdAt)}
                </p>
              </div>
              <Button disabled={accept.isPending} onClick={() => accept.mutate(r.id)}>
                {accept.isPending && accept.variables === r.id && (
                  <Loader2Icon className="animate-spin" aria-hidden />
                )}
                Accept
              </Button>
            </li>
          ))}
        </ul>
      )}
    </AsyncState>
  );
}
