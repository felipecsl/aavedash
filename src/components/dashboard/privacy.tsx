import { cn } from '../../lib/utils';
import type React from 'react';

export function SensitiveValue({
  children,
  hidden,
  className,
}: {
  children: React.ReactNode;
  hidden: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-block transition-[filter] duration-200',
        hidden && 'select-none blur-sm',
        className,
      )}
      aria-label={hidden ? 'Sensitive value hidden' : undefined}
    >
      {children}
    </span>
  );
}

export function SensitiveBlock({
  children,
  hidden,
  className,
}: {
  children: React.ReactNode;
  hidden: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn('transition-[filter] duration-200', hidden && 'select-none blur-sm', className)}
      aria-label={hidden ? 'Sensitive values hidden' : undefined}
    >
      {children}
    </div>
  );
}
