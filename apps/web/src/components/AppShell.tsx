'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useMe, useSession } from '@/features/auth/useMe';
import { money } from '@/lib/format';

export function AppShell({
  nav,
  children,
}: {
  nav: { href: string; label: string }[];
  children: React.ReactNode;
}) {
  const me = useMe();
  const session = useSession();
  const path = usePathname();
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="font-semibold tracking-tight">
            Dhaka <span className="text-primary">Tesla</span> Pool
          </Link>
          <nav className="flex gap-1" aria-label="Main">
            {nav.map((n) => {
              const active = n.href === path || (n.href !== nav[0].href && path.startsWith(n.href));
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-md px-2.5 py-1.5 text-sm ${active ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {me.data && (
              <span className="text-muted-foreground">
                {me.data.fullName}
                {me.data.role === 'PASSENGER' && ` · TeslaPay ${money(me.data.walletBalancePaisa)}`}
                {me.data.vehicle && ` · ${me.data.vehicle.name} (${me.data.vehicle.capacity} seats)`}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={session.end}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
