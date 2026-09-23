'use client';

import { Loader2Icon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCancelRide } from './queries';

export function CancelRideButton({ rideId, matched }: { rideId: string; matched: boolean }) {
  const [open, setOpen] = useState(false);
  const cancel = useCancelRide();
  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Cancel ride
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this ride?</DialogTitle>
            <DialogDescription>
              {matched ? 'Your seat is released for someone else. ' : ''}There is no cancellation fee.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Keep ride</DialogClose>
            <Button
              variant="destructive"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate(rideId, { onSettled: () => setOpen(false) })}
            >
              {cancel.isPending && <Loader2Icon className="animate-spin" aria-hidden />}
              Cancel ride
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
