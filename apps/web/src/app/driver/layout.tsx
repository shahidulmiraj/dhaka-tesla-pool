'use client';

import { AppShell } from '@/components/AppShell';
import { RequireRole } from '@/features/auth/RequireRole';

const NAV = [
  { href: '/driver', label: 'Dashboard' },
  { href: '/driver/pools', label: 'History' },
];

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole role="DRIVER">
      <AppShell nav={NAV}>{children}</AppShell>
    </RequireRole>
  );
}
