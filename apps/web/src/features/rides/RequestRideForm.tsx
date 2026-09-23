'use client';

import { Loader2Icon } from 'lucide-react';
import { useState } from 'react';
import { AsyncState } from '@/components/AsyncState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { FarePreview } from './FarePreview';
import { useCreateRide, useZones } from './queries';
import type { PaymentMethod, Zone } from './types';

const selectClass =
  'h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

export function RequestRideForm({ onRequested }: { onRequested: (rideId: string) => void }) {
  const zones = useZones();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Where to?</CardTitle>
        <CardDescription>
          Compatible trips from the same zone share a Tesla and split the fare.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AsyncState query={zones} skeleton={<Skeleton className="h-64 w-full" />}>
          {(list) => <Form zones={list} onRequested={onRequested} />}
        </AsyncState>
      </CardContent>
    </Card>
  );
}

function Form({ zones, onRequested }: { zones: Zone[]; onRequested: (rideId: string) => void }) {
  const banani = zones.find((z) => z.name === 'Banani')?.id ?? 0;
  const [pickupZoneId, setPickup] = useState(banani);
  const [dropoffZoneId, setDropoff] = useState(0);
  const [seats, setSeats] = useState(1);
  const [paymentMethod, setPayment] = useState<PaymentMethod>('TESLAPAY');
  const create = useCreateRide(onRequested);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate({ pickupZoneId, dropoffZoneId, seats, paymentMethod });
      }}
    >
      <fieldset disabled={create.isPending} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pickup">Pickup</Label>
            <select
              id="pickup"
              className={selectClass}
              value={pickupZoneId}
              onChange={(e) => setPickup(Number(e.target.value))}
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dropoff">Destination</Label>
            <select
              id="dropoff"
              required
              className={selectClass}
              value={dropoffZoneId || ''}
              onChange={(e) => setDropoff(Number(e.target.value))}
            >
              <option value="" disabled>
                Choose a zone
              </option>
              {zones.map((z) => (
                <option key={z.id} value={z.id} disabled={z.id === pickupZoneId}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="seats">Seats</Label>
            <select
              id="seats"
              className={selectClass}
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Payment</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['TESLAPAY', 'CASH'] as const).map((m) => (
                <label
                  key={m}
                  className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-sm has-checked:border-primary has-checked:bg-primary/5"
                >
                  <input
                    type="radio"
                    name="payment"
                    value={m}
                    checked={paymentMethod === m}
                    onChange={() => setPayment(m)}
                    className="accent-primary"
                  />
                  {m === 'TESLAPAY' ? 'TeslaPay' : 'Cash'}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <FarePreview pickupZoneId={pickupZoneId} dropoffZoneId={dropoffZoneId} seats={seats} />
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!dropoffZoneId || dropoffZoneId === pickupZoneId}
        >
          {create.isPending && <Loader2Icon className="animate-spin" aria-hidden />}
          Request a seat
        </Button>
      </fieldset>
    </form>
  );
}
