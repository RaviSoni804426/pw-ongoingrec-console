import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Spinner = ({ className }: { className?: string }) => (
  <Loader2 className={cn('h-4 w-4 animate-spin text-muted-foreground', className)} aria-hidden />
);

export const LoadingBlock = ({ label = 'Loading…' }: { label?: string }) => (
  <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground" role="status">
    <Spinner />
    {label}
  </div>
);

export const ErrorBlock = ({ error }: { error: unknown }) => (
  <div
    role="alert"
    data-testid="error-block"
    className="m-4 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
  >
    {error instanceof Error ? error.message : 'Something went wrong.'}
  </div>
);

export const EmptyBlock = ({ children }: { children: React.ReactNode }) => (
  <div className="p-8 text-center text-sm text-muted-foreground">{children}</div>
);
