import { useEffect, useState } from 'react';
import type { WatchdogConfig } from '@aave-monitor/core';

type State = {
  watchdog: WatchdogConfig | null;
  loading: boolean;
  error: string | null;
};

export function useWatchdogConfig(): State {
  const [state, setState] = useState<State>({ watchdog: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = (await response.json()) as { watchdog?: WatchdogConfig };
        if (cancelled) return;
        setState({ watchdog: body.watchdog ?? null, loading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load watchdog config';
        setState({ watchdog: null, loading: false, error: message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
