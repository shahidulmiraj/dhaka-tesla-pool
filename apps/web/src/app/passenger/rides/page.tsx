'use client';

import Link from 'next/link';
import { AsyncState } from '@/components/AsyncState';
import { EmptyState } from '@/components/EmptyState';
import { buttonVariants } from '@/components/ui/button';
import { RideList } from '@/features/rides/RideList';
import { useRides } from '@/features/rides/queries';

export default function RideHistoryPage() {
  const rides = useRides();
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">My rides</h1>
      <AsyncState
        query={rides}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            title="No rides yet"
            hint="Request your first Tesla and it will show up here."
            action={
              <Link href="/passenger" className={buttonVariants()}>
                Request a ride
              </Link>
            }
          />
        }
      >
        {(d) => <RideList rides={d.items} />}
      </AsyncState>
    </section>
  );
}
