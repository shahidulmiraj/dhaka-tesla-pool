'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { CenteredSpinner } from '@/components/CenteredSpinner';
import type { Role } from './types';
import { homeFor, useHasToken, useMe } from './useMe';

// Client-side guard: the token lives in localStorage, which Next middleware cannot read.
export function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const router = useRouter();
  const hasToken = useHasToken();
  const me = useMe(hasToken === true);

  useEffect(() => {
    if (hasToken === false || me.isError) router.replace('/login');
    else if (me.data && me.data.role !== role) router.replace(homeFor(me.data.role));
  }, [hasToken, me.isError, me.data, role, router]);

  if (hasToken !== true || !me.data || me.data.role !== role) return <CenteredSpinner />;
  return <>{children}</>;
}
