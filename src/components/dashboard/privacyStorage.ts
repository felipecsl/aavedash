export const DASHBOARD_PRIVACY_STORAGE_KEY = 'aave-monitor:hide-top-level-values';

export function getInitialDashboardPrivacy(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(DASHBOARD_PRIVACY_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}
