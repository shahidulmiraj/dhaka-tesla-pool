import { api } from '@/lib/api-client';
import type { PoolAction } from '@/lib/status';
import type { OpenRequest, PoolDetail, PoolSummary } from './types';

export const setOnline = (online: boolean) =>
  api<{ isOnline: boolean }>('/driver/status', { method: 'PATCH', body: { online } });
export const getOpenRequests = (pickupZoneId: number) =>
  api<OpenRequest[]>('/driver/requests', { query: { pickupZoneId } });
export const acceptRequest = (requestId: string) =>
  api<PoolDetail>('/driver/pools', { method: 'POST', body: { requestId } });
export const getActivePool = () => api<PoolDetail | null>('/driver/pools/active');
export const getPool = (id: string) => api<PoolDetail>(`/driver/pools/${id}`);
export const getPools = () =>
  api<{ items: PoolSummary[]; total: number }>('/driver/pools', { query: { limit: 50 } });
export const poolAction = (id: string, action: PoolAction) =>
  api<PoolDetail>(`/driver/pools/${id}/${action}`, { method: 'POST' });
