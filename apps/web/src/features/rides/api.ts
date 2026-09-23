import { api } from '@/lib/api-client';
import type { CreateRideInput, FareEstimate, RideDetail, RideSummary, Zone } from './types';

export const getZones = () => api<Zone[]>('/zones');
export const getEstimate = (q: { pickupZoneId: number; dropoffZoneId: number; seats: number }) =>
  api<FareEstimate>('/fare/estimate', { query: q });
export const createRide = (input: CreateRideInput) =>
  api<RideDetail>('/rides', { method: 'POST', body: input });
export const getActiveRide = () => api<RideDetail | null>('/rides/active');
export const getRide = (id: string) => api<RideDetail>(`/rides/${id}`);
export const getRides = () =>
  api<{ items: RideSummary[]; total: number }>('/rides', { query: { limit: 50 } });
export const cancelRide = (id: string) => api<RideDetail>(`/rides/${id}/cancel`, { method: 'POST' });
