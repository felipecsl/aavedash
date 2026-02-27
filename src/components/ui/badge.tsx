import * as React from 'react';
import { cva } from 'class-variance-authority';

import { cn } from '../../lib/utils';

export type BadgeVariant = 'default' | 'positive' | 'warning' | 'destructive';

const badgeVariants = cva('rounded-full px-2 py-[3px] text-[0.72rem] font-bold uppercase', {
  variants: {
    variant: {
      default: 'bg-slate-600 text-slate-50',
      positive: 'bg-green-600 text-green-50',
      warning: 'bg-amber-600 text-amber-50',
      destructive: 'bg-red-600 text-red-50',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

function Badge({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'span'> & { variant?: BadgeVariant }) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge };
