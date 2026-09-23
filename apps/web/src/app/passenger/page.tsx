'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AsyncState } from '@/components/AsyncState';
import { Skeleton } from '@/components/ui/skeleton';
import { RequestRideForm } from '@/features/rides/RequestRideForm';
import { RideStatusCard } from '@/features/rides/RideStatusCard';
import { useActiveRide } from '@/features/rides/queries';

// Active ride -> status card (kept on screen after it ends until dismissed); otherwise the form.
export default function PassengerHome() {
  const active = useActiveRide();
  const qc = useQueryClient();
  const [shown, setShown] = useState<string | null | undefined>(undefined); // undefined = follow the server

  return (
    <AsyncState query={active} skeleton={<Skeleton className="h-80 w-full" />}>
      {(ride) => {
        const rideId = shown === undefined ? ride?.id : shown;
        return rideId ? (
          <RideStatusCard
            rideId={rideId}
            onDone={() => {
              setShown(null);
              qc.invalidateQueries({ queryKey: ['me'] }); // wallet may have changed
            }}
          />
        ) : (
          <RequestRideForm onRequested={setShown} />
        );
      }}
    </AsyncState>
  );
}
