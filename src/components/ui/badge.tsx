import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-muted text-muted-foreground',
        outline: 'text-foreground',
        good: 'border-transparent bg-rag-good text-white',
        warn: 'border-transparent bg-rag-warn text-black',
        bad: 'border-transparent bg-rag-bad text-white',
      },
    },
    defaultVariants: { variant: 'secondary' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
);

/** Maps an Installation.state to the badge tone the fleet table uses. */
export const stateVariant = (state: string | undefined): BadgeProps['variant'] => {
  switch (state) {
    case 'ACTIVE':
      return 'good';
    case 'UNHEALTHY':
    case 'OFFLINE':
      return 'bad';
    case 'PROVISIONING':
      return 'warn';
    default:
      return 'secondary';
  }
};
