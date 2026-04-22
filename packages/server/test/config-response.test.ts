import assert from 'node:assert/strict';
import test from 'node:test';
import { serializeConfig } from '../src/configResponse.js';
import type { AlertConfig } from '../src/storage.js';

test('serializeConfig includes utilization settings', () => {
  const config: AlertConfig = {
    wallets: [{ address: '0x1111111111111111111111111111111111111111', enabled: true }],
    telegram: {
      chatId: 'chat-1',
      enabled: true,
    },
    polling: {
      intervalMs: 300_000,
      debounceChecks: 2,
      reminderIntervalMs: 1_800_000,
      cooldownMs: 1_800_000,
    },
    zones: [
      { name: 'safe', minHF: 2.2, maxHF: Infinity },
      { name: 'comfort', minHF: 1.9, maxHF: 2.2 },
      { name: 'watch', minHF: 1.6, maxHF: 1.9 },
      { name: 'alert', minHF: 1.3, maxHF: 1.6 },
      { name: 'action', minHF: 1.15, maxHF: 1.3 },
      { name: 'critical', minHF: 0, maxHF: 1.15 },
    ],
    watchdog: {
      enabled: false,
      dryRun: true,
      triggerHF: 1.65,
      targetHF: 1.9,
      minResultingHF: 1.85,
      cooldownMs: 1_800_000,
      maxRepayAmount: 500,
      deadlineSeconds: 300,
      rescueContract: '',
      morphoRescueContract: '',
      maxGasGwei: 50,
    },
    utilization: {
      enabled: true,
      defaultThreshold: 0.92,
      cooldownMs: 600_000,
    },
  };

  const serialized = serializeConfig(config);

  assert.deepEqual(serialized.utilization, config.utilization);
});
