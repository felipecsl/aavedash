import type { AlertConfig } from './storage.js';

export function serializeConfig(config: AlertConfig) {
  return {
    wallets: config.wallets,
    telegram: { chatId: config.telegram.chatId, enabled: config.telegram.enabled },
    polling: config.polling,
    zones: config.zones,
    watchdog: config.watchdog,
    utilization: config.utilization,
  };
}
