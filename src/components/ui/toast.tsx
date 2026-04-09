import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ToastContext, type ToastContextValue, type ToastMessage } from './toast-context';

export function ToastProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: ToastContextValue;
}) {
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function ToastViewport({ toasts }: { toasts: ToastMessage[] }) {
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[70] flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => {
        const isSuccess = toast.variant === 'success';

        return (
          <div
            key={toast.id}
            className={`rounded-xl border px-4 py-3 shadow-lg backdrop-blur ${
              isSuccess
                ? 'border-positive/40 bg-card text-foreground'
                : 'border-destructive/40 bg-card text-foreground'
            }`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 ${isSuccess ? 'text-positive' : 'text-destructive'}`}
                aria-hidden="true"
              >
                {isSuccess ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
              </div>
              <p className="text-sm font-medium">{toast.title}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
