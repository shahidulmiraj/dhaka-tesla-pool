'use client';

import { Loader2Icon, MapPinIcon, XIcon } from 'lucide-react';
import { AsyncState } from '@/components/AsyncState';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { when } from '@/lib/format';
import { useAccept, useDriverRequests } from './queries';

export function OpenRequestList({
  zoneId,
  zoneName,
  destinationZoneId,
  destinationZoneName,
  onSelectDestination,
  onClearDestination,
  onAccepted,
}: {
  zoneId: number;
  zoneName: string;
  destinationZoneId?: number;
  destinationZoneName?: string;
  onSelectDestination?: (id: number) => void;
  onClearDestination?: () => void;
  onAccepted: (poolId: string) => void;
}) {
  const requests = useDriverRequests(zoneId, destinationZoneId, true);
  const accept = useAccept(onAccepted);

  return (
    <div className="space-y-3">
      {destinationZoneId && destinationZoneName && (
        <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <div className="flex items-center gap-2">
            <MapPinIcon className="h-4 w-4 text-primary" />
            <span>
              Showing only trips dropping off at{' '}
              <strong className="font-semibold text-foreground">{destinationZoneName}</strong>
            </span>
          </div>
          {onClearDestination && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onClearDestination}
            >
              <XIcon className="mr-1 h-3.5 w-3.5" />
              Clear filter
            </Button>
          )}
        </div>
      )}

      <AsyncState
        query={requests}
        isEmpty={(d) => d.length === 0}
        empty={
          <EmptyState
            title={
              destinationZoneName
                ? `No passengers heading to ${destinationZoneName} right now`
                : `No one is waiting in ${zoneName} right now`
            }
            hint={
              destinationZoneName
                ? `There are no ride requests from ${zoneName} to ${destinationZoneName}. You can clear the filter to see other waiting passengers.`
                : 'This list refreshes every 4 seconds.'
            }
            action={
              destinationZoneId && onClearDestination ? (
                <Button variant="outline" size="sm" onClick={onClearDestination}>
                  Show all destinations
                </Button>
              ) : undefined
            }
          />
        }
      >
        {(list) => (
          <ul className="divide-y rounded-xl border bg-card" aria-live="polite">
            {list.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{r.passengerFirstName}</p>
                    <span className="text-muted-foreground">→</span>
                    <button
                      type="button"
                      className="rounded bg-secondary/80 px-2 py-0.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary transition-colors"
                      title={
                        destinationZoneId === r.dropoffZone.id
                          ? 'Filtered by this destination'
                          : `Filter trips to ${r.dropoffZone.name}`
                      }
                      onClick={() => onSelectDestination?.(r.dropoffZone.id)}
                    >
                      {r.dropoffZone.name}
                    </button>
                  </div>
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
    </div>
  );
}
