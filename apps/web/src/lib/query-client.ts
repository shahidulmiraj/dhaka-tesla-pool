import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api-client';

export const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // 4xx are answers, not outages: do not retry them. Network errors and 5xx
        // (e.g. a Render cold start) get two retries with backoff.
        retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
