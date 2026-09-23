'use client';

import { AppShell } from '@/components/AppShell';
import { RequireRole } from '@/features/auth/RequireRole';

const NAV = [
  { href: '/passenger', label: 'Request' },
  { href: '/passenger/rides', label: 'My rides' },
];

export default function PassengerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole role="PASSENGER">
      <AppShell nav={NAV}>{children}</AppShell>
    </RequireRole>
  );
}
