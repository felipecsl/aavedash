import * as React from 'react';

import { cn } from '../../lib/utils';

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'rounded-[18px] border border-[rgba(168,191,217,0.22)] bg-[linear-gradient(140deg,rgba(11,24,39,0.82),rgba(9,16,28,0.6))] backdrop-blur-[8px]',
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="card-header" className={cn('px-[18px] pt-[18px]', className)} {...props} />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={cn('grid gap-3 px-[18px] pt-[14px] pb-[18px]', className)}
      {...props}
    />
  );
}

export { Card, CardContent, CardHeader };
