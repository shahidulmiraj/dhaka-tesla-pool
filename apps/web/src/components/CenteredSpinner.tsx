import { Loader2Icon } from 'lucide-react';

export function CenteredSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-12" role="status">
      <Loader2Icon className="size-6 animate-spin text-muted-foreground" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  );
}
