'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Me } from '@/features/auth/types';
import { isTerminal, type PoolAction } from '@/lib/status';
import * as driver from './api';

const POLL_MS = 4000;

export const useDriverRequests = (zoneId: number, enabled: boolean) =>
  useQuery({
    queryKey: ['driver', 'requests', zoneId],
    queryFn: () => driver.getOpenRequests(zoneId),
    enabled: enabled && zoneId > 0,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });

// Polled so a passenger auto-joining (Shirin grabbing the last seat) shows up.
export const useActivePool = () =>
  useQuery({
    queryKey: ['driver', 'pools', 'active'],
    queryFn: driver.getActivePool,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });

export const usePool = (id: string) =>
  useQuery({
    queryKey: ['driver', 'pools', id],
    queryFn: () => driver.getPool(id),
    refetchInterval: (q) => (isTerminal(q.state.data?.status) ? false : POLL_MS),
    refetchIntervalInBackground: false,
  });

export const usePools = () => useQuery({ queryKey: ['driver', 'pools', 'list'], queryFn: driver.getPools });

export function useSetOnline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: driver.setOnline,
    onSuccess: ({ isOnline }) => {
      qc.setQueryData<Me>(['me'], (me) => me && { ...me, isOnline });
      qc.invalidateQueries({ queryKey: ['driver'] });
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useAccept(onAccepted: (poolId: string) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: driver.acceptRequest,
    onSuccess: (pool) => {
      qc.setQueryData(['driver', 'pools', pool.id], pool);
      qc.invalidateQueries({ queryKey: ['driver'] });
      toast.success(`${pool.vehicleName}: ${pool.seatsTaken} / ${pool.capacity} seats filled`);
      onAccepted(pool.id);
    },
    onError: (e) => {
      toast.error(e.message);
      qc.invalidateQueries({ queryKey: ['driver', 'requests'] });
    },
  });
}

const DONE: Record<PoolAction, string> = {
  arrive: 'Passengers notified: you have arrived',
  start: 'Trip started; fares locked',
  complete: 'Trip completed; payments settled',
  cancel: 'Pool cancelled; passengers returned to the queue',
};

export function usePoolAction(poolId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: PoolAction) => driver.poolAction(poolId, action),
    onSuccess: (pool, action) => {
      qc.setQueryData(['driver', 'pools', pool.id], pool);
      qc.invalidateQueries({ queryKey: ['driver'] });
      toast.success(DONE[action]);
    },
    onError: (e) => {
      toast.error(e.message);
      qc.invalidateQueries({ queryKey: ['driver', 'pools', poolId] });
    },
  });
}
