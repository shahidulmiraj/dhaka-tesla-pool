'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { CenteredSpinner } from '@/components/CenteredSpinner';
import { homeFor, useHasToken, useMe } from '@/features/auth/useMe';

// Root: send people where they belong.
export default function Home() {
  const router = useRouter();
  const hasToken = useHasToken();
  const me = useMe(hasToken === true);
  useEffect(() => {
    if (hasToken === false || me.isError) router.replace('/login');
    else if (me.data) router.replace(homeFor(me.data.role));
  }, [hasToken, me.isError, me.data, router]);
  return <CenteredSpinner />;
}
