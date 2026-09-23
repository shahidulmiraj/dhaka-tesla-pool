'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { clearToken, readToken, subscribeToken, writeToken } from '@/lib/api-client';
import { getMe } from './api';
import type { Session } from './types';

// null while rendering on the server / hydrating (unknown), then true or false.
// localStorage is never read during a server render, so no hydration mismatch.
export const useHasToken = () =>
  useSyncExternalStore<boolean | null>(
    subscribeToken,
    () => !!readToken(),
    () => null,
  );

// Role comes from the API, never decoded from the JWT in the browser.
export const useMe = (enabled = true) =>
  useQuery({ queryKey: ['me'], queryFn: getMe, enabled, staleTime: Infinity, retry: false });

export const homeFor = (role: Session['user']['role']) => (role === 'DRIVER' ? '/driver' : '/passenger');

export function useSession() {
  const qc = useQueryClient();
  const router = useRouter();
  return {
    start(session: Session) {
      writeToken(session.token);
      qc.setQueryData(['me'], session.user);
      router.replace(homeFor(session.user.role));
    },
    end() {
      clearToken();
      qc.clear();
      router.replace('/login');
    },
  };
}
