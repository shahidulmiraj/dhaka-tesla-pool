'use client';

import { Loader2Icon } from 'lucide-react';
import { useSetOnline } from './queries';

export function AvailabilityToggle({ online }: { online: boolean }) {
  const set = useSetOnline();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={online}
      disabled={set.isPending}
      onClick={() => set.mutate(!online)}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
        online ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'
      }`}
    >
      {set.isPending ? (
        <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <span
          className={`size-2.5 rounded-full ${online ? 'bg-primary-foreground' : 'bg-muted-foreground'}`}
          aria-hidden
        />
      )}
      {online ? 'Online' : 'Offline'}
    </button>
  );
}
