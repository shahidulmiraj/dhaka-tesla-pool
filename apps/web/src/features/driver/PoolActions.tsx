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
import { type PoolAction, POOL_ACTIONS, type PoolStatus } from '@/lib/status';
import { usePoolAction } from './queries';

const LABEL: Record<Exclude<PoolAction, 'cancel'>, string> = {
  arrive: 'Mark arrived',
  start: 'Start trip',
  complete: 'Complete trip',
};

// Buttons come from the same transition table as the API; the server still decides.
export function PoolActions({ poolId, status }: { poolId: string; status: PoolStatus }) {
  const action = usePoolAction(poolId);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const allowed = POOL_ACTIONS[status];
  if (allowed.length === 0) return null;
  const spinner = (a: PoolAction) =>
    action.isPending && action.variables === a && <Loader2Icon className="animate-spin" aria-hidden />;

  return (
    <div className="flex flex-wrap gap-2">
      {allowed
        .filter((a) => a !== 'cancel')
        .map((a) => (
          <Button key={a} size="lg" disabled={action.isPending} onClick={() => action.mutate(a)}>
            {spinner(a)}
            {LABEL[a as Exclude<PoolAction, 'cancel'>]}
          </Button>
        ))}
      {allowed.includes('cancel') && (
        <>
          <Button
            size="lg"
            variant="destructive"
            disabled={action.isPending}
            onClick={() => setConfirmCancel(true)}
          >
            Cancel pool
          </Button>
          <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancel this pool?</DialogTitle>
                <DialogDescription>
                  Every passenger goes back to the waiting queue, keeping their place, and can be picked up by
                  another driver.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Keep pool</DialogClose>
                <Button
                  variant="destructive"
                  disabled={action.isPending}
                  onClick={() => action.mutate('cancel', { onSettled: () => setConfirmCancel(false) })}
                >
                  {spinner('cancel')}
                  Cancel pool
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
