import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-80',
  {
    variants: {
      variant: {
        default:
          'border border-[rgba(168,191,217,0.35)] bg-[linear-gradient(135deg,#2f5eab,#2b4270)] text-[#eff6ff]',
        secondary: 'border border-[rgba(168,191,217,0.35)] bg-[rgba(8,18,30,0.82)] text-[#d9e6f7]',
      },
      size: {
        default: 'h-[38px] px-[14px]',
        sm: 'h-9 px-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant,
  size,
  type = 'button',
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      data-slot="button"
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button };
