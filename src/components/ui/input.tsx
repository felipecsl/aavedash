import * as React from 'react';

import { cn } from '../../lib/utils';

function Input({ className, type = 'text', ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        'h-9 w-full min-w-0 max-w-[460px] rounded-[10px] border border-[rgba(168,191,217,0.3)] bg-[rgba(4,9,16,0.7)] px-[10px] text-[#e8f2ff] outline-none focus:border-transparent focus:ring-2 focus:ring-[#3f7ad8]',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
