'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

// Render's free tier sleeps after 15 min; the first request can take ~60 s.
export function ColdStartBanner() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api<{ status: string }>('/health', { base: 'root' }),
    retry: 10,
    retryDelay: 3000,
    staleTime: 60_000,
  });
  if (health.isPending && health.failureCount > 0) {
    return (
      <div role="status" className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
        Waking up the API (free-tier cold start, up to 60 s)…
      </div>
    );
  }
  if (health.isError) {
    return (
      <div role="alert" className="bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">
        The API is unreachable right now. Please try again in a minute.
      </div>
    );
  }
  return null;
}
