import { COINGECKO_IDS_BY_SYMBOL } from './constants.js';

export async function fetchUsdPrices(
  symbols: string[],
  coingeckoApiKey: string | undefined,
): Promise<Map<string, number>> {
  const ids = Array.from(
    new Set(
      symbols
        .map((symbol) => COINGECKO_IDS_BY_SYMBOL[symbol.toUpperCase()])
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (ids.length === 0) return new Map();

  const query = new URLSearchParams({
    ids: ids.join(','),
    vs_currencies: 'usd',
  });

  if (coingeckoApiKey) {
    query.set('x_cg_demo_api_key', coingeckoApiKey);
  }

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?${query.toString()}`,
    );
    if (!response.ok) {
      return new Map();
    }

    const payload = (await response.json()) as Record<string, { usd?: number }>;
    const prices = new Map<string, number>();

    Object.entries(COINGECKO_IDS_BY_SYMBOL).forEach(([symbol, id]) => {
      const usd = payload[id]?.usd;
      if (typeof usd === 'number') {
        prices.set(symbol.toUpperCase(), usd);
      }
    });

    return prices;
  } catch {
    return new Map();
  }
}
