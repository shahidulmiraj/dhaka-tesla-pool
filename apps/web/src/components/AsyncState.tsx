'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// The loading / error / empty rubric in one place.
export function AsyncState<T>({
  query,
  children,
  empty,
  isEmpty,
  skeleton,
  errorFallback,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => React.ReactNode;
  empty?: React.ReactNode;
  isEmpty?: (data: T) => boolean;
  skeleton?: React.ReactNode;
  errorFallback?: (error: Error) => React.ReactNode | undefined;
}) {
  if (query.isPending) {
    return (
      skeleton ?? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )
    );
  }
  if (query.isError) {
    return (
      errorFallback?.(query.error) ?? (
        <Alert variant="destructive">
          <AlertTitle>Could not load this</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{query.error.message}</span>
            <Button size="sm" variant="outline" onClick={() => query.refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )
    );
  }
  if (isEmpty?.(query.data)) return <>{empty}</>;
  return <>{children(query.data)}</>;
}
