import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { ConfigStorage } from './storage.js';
import { TelegramClient } from './telegram.js';
import { Monitor } from './monitor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_ENV_PATH = join(__dirname, '..', '..', '..', '.env');

if (existsSync(ROOT_ENV_PATH)) {
  process.loadEnvFile(ROOT_ENV_PATH);
}

const PORT = Number(process.env.PORT ?? 3001);
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const GRAPH_API_KEY = process.env.VITE_THE_GRAPH_API_KEY ?? process.env.THE_GRAPH_API_KEY;
const COINGECKO_API_KEY = process.env.VITE_COINGECKO_API_KEY ?? process.env.COINGECKO_API_KEY;

const configPath = join(__dirname, '..', 'data', 'config.json');
const storage = new ConfigStorage(configPath);
const telegram = new TelegramClient(TELEGRAM_BOT_TOKEN);
const monitor = new Monitor(telegram, () => storage.get(), GRAPH_API_KEY, COINGECKO_API_KEY);

const app = express();
app.use(express.json());

app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.options('*all', (_req, res) => {
  res.sendStatus(204);
});

app.get('/api/config', (_req, res) => {
  const config = storage.get();
  res.json({
    wallets: config.wallets,
    telegram: { chatId: config.telegram.chatId, enabled: config.telegram.enabled },
    polling: config.polling,
    zones: config.zones,
  });
});

app.put('/api/config', (req, res) => {
  const body = req.body as Record<string, unknown>;
  const updated = storage.update(body);
  monitor.restart();
  res.json({
    wallets: updated.wallets,
    telegram: { chatId: updated.telegram.chatId, enabled: updated.telegram.enabled },
    polling: updated.polling,
    zones: updated.zones,
  });
});

app.post('/api/telegram/test', async (_req, res) => {
  const config = storage.get();
  if (!config.telegram.chatId) {
    res.status(400).json({ error: 'No chat ID configured' });
    return;
  }
  if (!TELEGRAM_BOT_TOKEN) {
    res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not set on server' });
    return;
  }

  const success = await telegram.sendMessage(
    config.telegram.chatId,
    '\u{2705} <b>Test notification</b>\n\nAave Loan Monitor is connected and working.',
  );

  if (success) {
    res.json({ ok: true });
  } else {
    res
      .status(502)
      .json({ error: 'Failed to send Telegram message. Check bot token and chat ID.' });
  }
});

app.get('/api/status', (_req, res) => {
  res.json(monitor.getStatus());
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`Aave monitor server listening on port ${PORT}`);

  const config = storage.get();
  if (config.telegram.enabled && config.telegram.chatId && TELEGRAM_BOT_TOKEN) {
    monitor.start();
  } else {
    console.log('Monitor not started: telegram not configured or enabled');
  }
});
