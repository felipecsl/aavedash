import { createContext, useContext } from 'react';

export type ToastVariant = 'success' | 'error';

export type ToastMessage = {
  id: number;
  title: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);
export type { ToastContextValue };

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
