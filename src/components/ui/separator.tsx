import * as React from 'react';

import { cn } from '../../lib/utils';

function Separator({
  className,
  orientation = 'horizontal',
  ...props
}: React.ComponentProps<'div'> & { orientation?: 'horizontal' | 'vertical' }) {
  return (
    <div
      data-slot="separator"
      role="separator"
      aria-orientation={orientation}
      className={cn(
        orientation === 'horizontal' ? 'my-0.5 h-px w-full' : 'h-full w-px',
        'shrink-0 bg-[rgba(168,191,217,0.2)]',
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
