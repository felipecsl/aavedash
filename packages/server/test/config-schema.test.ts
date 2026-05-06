import assert from 'node:assert/strict';
import test from 'node:test';
import { parseConfigBody } from '../src/configSchema.js';

test('parseConfigBody accepts morphoRescueContract updates', () => {
  const parsed = parseConfigBody({
    watchdog: {
      morphoRescueContract: '0x3333333333333333333333333333333333333333',
    },
  });

  assert.ok('data' in parsed);
  assert.equal(
    parsed.data.watchdog?.morphoRescueContract,
    '0x3333333333333333333333333333333333333333',
  );
});

test('parseConfigBody maps legacy maxTopUpWbtc to maxRepayAmount', () => {
  const parsed = parseConfigBody({
    watchdog: {
      maxTopUpWbtc: 0.75,
    },
  });

  assert.ok('data' in parsed);
  assert.equal(parsed.data.watchdog?.maxRepayAmount, 0.75);
});

test('parseConfigBody accepts valid borrow rate config', () => {
  const parsed = parseConfigBody({
    borrowRate: {
      enabled: true,
      cooldownMs: 600_000,
    },
  });

  assert.ok('data' in parsed);
  assert.equal(parsed.data.borrowRate?.enabled, true);
  assert.equal(parsed.data.borrowRate?.cooldownMs, 600_000);
});

test('parseConfigBody rejects non-positive borrow rate cooldown', () => {
  const parsed = parseConfigBody({
    borrowRate: {
      cooldownMs: 0,
    },
  });

  assert.ok('error' in parsed);
});

test('parseConfigBody accepts partial borrow rate config', () => {
  const parsed = parseConfigBody({
    borrowRate: {
      enabled: false,
    },
  });

  assert.ok('data' in parsed);
  assert.equal(parsed.data.borrowRate?.enabled, false);
  assert.equal(parsed.data.borrowRate?.cooldownMs, undefined);
});
