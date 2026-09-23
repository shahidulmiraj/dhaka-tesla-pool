'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { isTerminal } from '@/lib/status';
import * as rides from './api';

const POLL_MS = 4000;

export const useZones = () => useQuery({ queryKey: ['zones'], queryFn: rides.getZones, staleTime: Infinity });

export const useFareEstimate = (q: { pickupZoneId: number; dropoffZoneId: number; seats: number } | null) =>
  useQuery({
    queryKey: ['fare', q],
    queryFn: () => rides.getEstimate(q!),
    enabled: !!q && q.pickupZoneId !== q.dropoffZoneId,
    staleTime: Infinity,
  });

export const useActiveRide = () => useQuery({ queryKey: ['rides', 'active'], queryFn: rides.getActiveRide });

// Polls every 4 s while the ride can still change; stops on COMPLETED / CANCELLED.
export const useRide = (id: string) =>
  useQuery({
    queryKey: ['rides', id],
    queryFn: () => rides.getRide(id),
    refetchInterval: (q) => (isTerminal(q.state.data?.status) ? false : POLL_MS),
    refetchIntervalInBackground: false,
  });

export const useRides = () => useQuery({ queryKey: ['rides', 'list'], queryFn: rides.getRides });

export function useCreateRide(onCreated: (id: string) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: rides.createRide,
    onSuccess: (ride) => {
      qc.setQueryData(['rides', ride.id], ride);
      qc.invalidateQueries({ queryKey: ['rides'] });
      toast.success(ride.pool ? `Matched with ${ride.pool.vehicleName}` : 'Looking for a Tesla…');
      onCreated(ride.id);
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useCancelRide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: rides.cancelRide,
    onSuccess: (ride) => {
      qc.setQueryData(['rides', ride.id], ride);
      qc.invalidateQueries({ queryKey: ['rides'] });
      toast.success('Ride cancelled');
    },
    onError: (e) => toast.error(e.message),
  });
}
