import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, Info, RefreshCw, ShieldCheck, Wallet } from 'lucide-react';

type BadgeTone = 'neutral' | 'positive' | 'warning' | 'danger';

type RawUserReserve = {
  currentATokenBalance: string;
  currentTotalDebt: string;
  usageAsCollateralEnabledOnUser: boolean;
  reserve: {
    symbol: string;
    decimals: number;
    underlyingAsset: string;
    baseLTVasCollateral: string;
    reserveLiquidationThreshold: string;
    liquidityRate: string;
    variableBorrowRate: string;
  };
};

type AssetPosition = {
  symbol: string;
  address: string;
  amount: number;
  usdPrice: number;
  usdValue: number;
  collateralEnabled: boolean;
  maxLTV: number;
  liqThreshold: number;
  supplyRate: number;
  borrowRate: number;
};

type LoanPosition = {
  id: string;
  marketName: string;
  borrowed: AssetPosition;
  supplied: AssetPosition[];
  totalSuppliedUsd: number;
  totalBorrowedUsd: number;
};

type RawUserReserveWithMarket = RawUserReserve & { __marketName: string };

type FetchState = {
  wallet: string;
  loans: LoanPosition[];
  lastUpdated: string;
};

type Computed = {
  units: number;
  px: number;
  debt: number;
  collateralUSD: number;
  equity: number;
  ltv: number;
  leverage: number;
  healthFactor: number;
  liqPrice: number;
  collateralUSDAtLiq: number;
  ltvAtLiq: number;
  priceDropToLiq: number;
  supplyEarnUSD: number;
  borrowCostUSD: number;
  deployEarnUSD: number;
  netEarnUSD: number;
  netAPYOnEquity: number;
  maxBorrowByLTV: number;
  borrowHeadroom: number;
  borrowPowerUsed: number;
  equityMoveFor10Pct: number;
  collateralBufferUSD: number;
  alertHF: boolean;
  alertLTV: boolean;
  ltvMax: number;
  lt: number;
  rSupply: number;
  rBorrow: number;
  rDeploy: number;
  primaryCollateralSymbol: string;
};

const GRAPH_API_KEY = import.meta.env.VITE_THE_GRAPH_API_KEY as string | undefined;
const COINGECKO_API_KEY = import.meta.env.VITE_COINGECKO_API_KEY as string | undefined;

const AAVE_MARKETS = [
  {
    marketName: 'proto_mainnet_v3',
    graphSubgraphId: 'Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g',
    fallbackEndpoints: ['https://api.thegraph.com/subgraphs/name/aave/protocol-v3'],
  },
  {
    marketName: 'proto_lido_v3',
    graphSubgraphId: '5vxMbXRhG1oQr55MWC5j6qg78waWujx1wjeuEWDA6j3',
    fallbackEndpoints: [],
  },
] as const;

const COINGECKO_IDS_BY_SYMBOL: Record<string, string> = {
  ETH: 'ethereum',
  WETH: 'weth',
  WBTC: 'wrapped-bitcoin',
  USDC: 'usd-coin',
  USDT: 'tether',
  DAI: 'dai',
  LDO: 'lido-dao',
  LINK: 'chainlink',
  AAVE: 'aave',
  CRV: 'curve-dao-token',
  MKR: 'maker',
  UNI: 'uniswap',
  SNX: 'havven',
  BAL: 'balancer',
};

const USER_RESERVES_QUERY = `
  query UserReserves($user: String!) {
    userReserves(first: 200, where: { user: $user }) {
      currentATokenBalance
      currentTotalDebt
      usageAsCollateralEnabledOnUser
      reserve {
        symbol
        decimals
        underlyingAsset
        baseLTVasCollateral
        reserveLiquidationThreshold
        liquidityRate
        variableBorrowRate
      }
    }
  }
`;

const ETHEREUM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

function getWalletFromQueryString(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('wallet') ?? params.get('address') ?? params.get('walletAddress') ?? '';
}

function n(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value.replaceAll(',', ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fmtUSD(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function fmtPct(value: number, digits = 2): string {
  return `${(value * 100).toFixed(digits)}%`;
}

function fmtAmount(value: number, digits = 4): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function parseBalance(raw: string, decimals: number): number {
  const normalized = Number(raw) / 10 ** decimals;
  return Number.isFinite(normalized) ? normalized : 0;
}

function fromBps(raw: string): number {
  return clamp(n(raw) / 10_000, 0, 0.99);
}

function fromRay(raw: string): number {
  return Math.max(0, n(raw) / 10 ** 27);
}

function weightedAverage(
  items: AssetPosition[],
  valueSelector: (item: AssetPosition) => number,
): number {
  const totalWeight = items.reduce((sum, item) => sum + item.usdValue, 0);
  if (totalWeight <= 0) return 0;

  const weighted = items.reduce((sum, item) => sum + valueSelector(item) * item.usdValue, 0);
  return weighted / totalWeight;
}

function healthLabel(hf: number): { label: string; tone: BadgeTone } {
  if (!Number.isFinite(hf) || hf <= 0) return { label: 'Invalid', tone: 'danger' };
  if (hf < 1.1) return { label: 'Danger', tone: 'danger' };
  if (hf < 1.5) return { label: 'Tight', tone: 'warning' };
  if (hf < 2) return { label: 'OK', tone: 'neutral' };
  return { label: 'Safe', tone: 'positive' };
}

async function fetchFromAaveSubgraph(wallet: string): Promise<RawUserReserveWithMarket[]> {
  const marketResults = await Promise.all(
    AAVE_MARKETS.map(async (market) => {
      const graphGatewayEndpoint = GRAPH_API_KEY
        ? `https://gateway-arbitrum.network.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/${market.graphSubgraphId}`
        : null;

      const endpoints = [
        ...(graphGatewayEndpoint ? [graphGatewayEndpoint] : []),
        ...market.fallbackEndpoints,
      ];
      const failures: string[] = [];
      let sawHostedServiceRemoval = false;

      if (endpoints.length === 0) {
        return {
          marketName: market.marketName,
          reserves: [] as RawUserReserve[],
          failures: ['No endpoint configured (set VITE_THE_GRAPH_API_KEY).'],
          sawHostedServiceRemoval: false,
        };
      }

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              query: USER_RESERVES_QUERY,
              variables: { user: wallet.toLowerCase() },
            }),
          });

          if (!response.ok) {
            failures.push(`${endpoint} (${response.status})`);
            continue;
          }

          const payload = (await response.json()) as {
            data?: { userReserves?: RawUserReserve[] };
            errors?: Array<{ message: string }>;
          };

          if (payload.errors?.length) {
            if (
              payload.errors.some((entry) =>
                entry.message.toLowerCase().includes('endpoint has been removed'),
              )
            ) {
              sawHostedServiceRemoval = true;
            }
            failures.push(`${endpoint} (GraphQL error)`);
            continue;
          }

          return {
            marketName: market.marketName,
            reserves: payload.data?.userReserves ?? [],
            failures: [] as string[],
            sawHostedServiceRemoval: false,
          };
        } catch {
          failures.push(`${endpoint} (network)`);
        }
      }

      return {
        marketName: market.marketName,
        reserves: [] as RawUserReserve[],
        failures,
        sawHostedServiceRemoval,
      };
    }),
  );

  const successfulResults = marketResults.filter((result) => result.failures.length === 0);
  if (successfulResults.length > 0) {
    return successfulResults.flatMap((result) =>
      result.reserves.map((reserve) => ({ ...reserve, __marketName: result.marketName })),
    );
  }

  const sawHostedServiceRemoval = marketResults.some((result) => result.sawHostedServiceRemoval);
  if (!GRAPH_API_KEY && sawHostedServiceRemoval) {
    throw new Error(
      'Aave subgraph hosted-service endpoints were deprecated. Set VITE_THE_GRAPH_API_KEY in your .env (The Graph API key) and restart the dev server.',
    );
  }

  const failureText = marketResults
    .map((result) => `${result.marketName}: ${result.failures.join(', ')}`)
    .join(' | ');
  throw new Error(
    `Unable to fetch Aave user reserves from public endpoints. Tried: ${failureText}`,
  );
}

async function fetchUsdPrices(symbols: string[]): Promise<Map<string, number>> {
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

  if (COINGECKO_API_KEY) {
    query.set('x_cg_demo_api_key', COINGECKO_API_KEY);
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

function toAssetPosition(
  raw: RawUserReserve,
  amount: number,
  prices: Map<string, number>,
): AssetPosition {
  const address = raw.reserve.underlyingAsset.toLowerCase();
  const symbol = raw.reserve.symbol.toUpperCase();
  const usdPrice = prices.get(symbol) ?? 0;

  return {
    symbol,
    address,
    amount,
    usdPrice,
    usdValue: amount * usdPrice,
    collateralEnabled: raw.usageAsCollateralEnabledOnUser,
    maxLTV: fromBps(raw.reserve.baseLTVasCollateral),
    liqThreshold: fromBps(raw.reserve.reserveLiquidationThreshold),
    supplyRate: fromRay(raw.reserve.liquidityRate),
    borrowRate: fromRay(raw.reserve.variableBorrowRate),
  };
}

function buildLoanPositions(
  reserves: RawUserReserveWithMarket[],
  prices: Map<string, number>,
): LoanPosition[] {
  const loansByMarket = new Map<string, RawUserReserveWithMarket[]>();

  reserves.forEach((reserve) => {
    const group = loansByMarket.get(reserve.__marketName) ?? [];
    group.push(reserve);
    loansByMarket.set(reserve.__marketName, group);
  });

  return Array.from(loansByMarket.entries()).flatMap(([marketName, marketReserves]) => {
    const suppliedAssets = marketReserves
      .map((entry) => {
        const amount = parseBalance(entry.currentATokenBalance, entry.reserve.decimals);
        return toAssetPosition(entry, amount, prices);
      })
      .filter((entry) => entry.amount > 0);

    const borrowedAssets = marketReserves
      .map((entry) => {
        const amount = parseBalance(entry.currentTotalDebt, entry.reserve.decimals);
        return toAssetPosition(entry, amount, prices);
      })
      .filter((entry) => entry.amount > 0);

    const collateralSupplies = suppliedAssets.filter((asset) => asset.collateralEnabled);

    return borrowedAssets.map((borrowed, index) => ({
      id: `${marketName}-${borrowed.address}-${index}`,
      marketName,
      borrowed,
      supplied: collateralSupplies,
      totalBorrowedUsd: borrowed.usdValue,
      totalSuppliedUsd: collateralSupplies.reduce((sum, asset) => sum + asset.usdValue, 0),
    }));
  });
}

function computeLoanMetrics(loan: LoanPosition | null): Computed {
  if (!loan) {
    return {
      units: 0,
      px: 0,
      debt: 0,
      collateralUSD: 0,
      equity: 0,
      ltv: 0,
      leverage: 0,
      healthFactor: Infinity,
      liqPrice: Infinity,
      collateralUSDAtLiq: Infinity,
      ltvAtLiq: 0,
      priceDropToLiq: 0,
      supplyEarnUSD: 0,
      borrowCostUSD: 0,
      deployEarnUSD: 0,
      netEarnUSD: 0,
      netAPYOnEquity: 0,
      maxBorrowByLTV: 0,
      borrowHeadroom: 0,
      borrowPowerUsed: 0,
      equityMoveFor10Pct: 0,
      collateralBufferUSD: 0,
      alertHF: false,
      alertLTV: false,
      ltvMax: 0,
      lt: 0,
      rSupply: 0,
      rBorrow: 0,
      rDeploy: 0,
      primaryCollateralSymbol: '—',
    };
  }

  const debt = loan.totalBorrowedUsd;
  const collateralUSD = loan.totalSuppliedUsd;
  const equity = collateralUSD - debt;

  const ltvMax = weightedAverage(loan.supplied, (asset) => asset.maxLTV);
  const lt = weightedAverage(loan.supplied, (asset) => asset.liqThreshold);
  const rSupply = weightedAverage(loan.supplied, (asset) => asset.supplyRate);
  const rBorrow = loan.borrowed.borrowRate;
  const rDeploy = 0;

  const ltv = collateralUSD > 0 ? debt / collateralUSD : 0;
  const leverage = equity > 0 ? collateralUSD / equity : Infinity;
  const healthFactor = debt > 0 ? (collateralUSD * lt) / debt : Infinity;

  const primary =
    loan.supplied.length > 0
      ? loan.supplied.reduce((max, current) => (current.usdValue > max.usdValue ? current : max))
      : null;

  const units = primary?.amount ?? 0;
  const px = primary?.usdPrice ?? 0;
  const primaryCollateralSymbol = primary?.symbol ?? '—';

  const collateralUSDAtLiq = lt > 0 ? debt / lt : Infinity;
  const collateralOtherUSD = collateralUSD - (primary?.usdValue ?? 0);
  const primaryUsdAtLiq = collateralUSDAtLiq - collateralOtherUSD;
  const liqPrice = units > 0 ? primaryUsdAtLiq / units : Infinity;
  const ltvAtLiq = collateralUSDAtLiq > 0 ? debt / collateralUSDAtLiq : 0;
  const priceDropToLiq = px > 0 && Number.isFinite(liqPrice) ? (px - liqPrice) / px : 0;

  const supplyEarnUSD = collateralUSD * rSupply;
  const borrowCostUSD = debt * rBorrow;
  const deployEarnUSD = debt * rDeploy;

  const netEarnUSD = supplyEarnUSD + deployEarnUSD - borrowCostUSD;
  const netAPYOnEquity = equity > 0 ? netEarnUSD / equity : 0;

  const maxBorrowByLTV = collateralUSD * ltvMax;
  const borrowHeadroom = maxBorrowByLTV - debt;
  const borrowPowerUsed = maxBorrowByLTV > 0 ? debt / maxBorrowByLTV : 0;

  const equityMoveFor10Pct = Number.isFinite(leverage) ? leverage * 0.1 : 0;
  const collateralBufferUSD = collateralUSD - collateralUSDAtLiq;

  const alertHF = healthFactor < 1.5;
  const alertLTV = ltv > 0.7 * lt;

  return {
    units,
    px,
    debt,
    collateralUSD,
    equity,
    ltv,
    leverage,
    healthFactor,
    liqPrice,
    collateralUSDAtLiq,
    ltvAtLiq,
    priceDropToLiq,
    supplyEarnUSD,
    borrowCostUSD,
    deployEarnUSD,
    netEarnUSD,
    netAPYOnEquity,
    maxBorrowByLTV,
    borrowHeadroom,
    borrowPowerUsed,
    equityMoveFor10Pct,
    collateralBufferUSD,
    alertHF,
    alertLTV,
    ltvMax,
    lt,
    rSupply,
    rBorrow,
    rDeploy,
    primaryCollateralSymbol,
  };
}

export default function App() {
  const [wallet, setWallet] = useState(() => getWalletFromQueryString());
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<FetchState | null>(null);
  const hasAutoFetchedFromQuery = useRef(false);

  const selectedLoan = useMemo(() => {
    if (!result || result.loans.length === 0) return null;
    return result.loans.find((loan) => loan.id === selectedLoanId) ?? result.loans[0] ?? null;
  }, [result, selectedLoanId]);

  const computed = useMemo(() => computeLoanMetrics(selectedLoan), [selectedLoan]);
  const status = healthLabel(computed.healthFactor);

  const fetchLoans = async (normalizedWallet: string) => {
    setError('');
    setIsLoading(true);

    try {
      const reserves = await fetchFromAaveSubgraph(normalizedWallet);
      const reserveSymbols = Array.from(new Set(reserves.map((entry) => entry.reserve.symbol)));
      const prices = await fetchUsdPrices(reserveSymbols);
      const loans = buildLoanPositions(reserves, prices);

      setResult({
        wallet: normalizedWallet,
        loans,
        lastUpdated: new Date().toISOString(),
      });
      setSelectedLoanId(loans[0]?.id ?? '');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch loan data.';
      setError(message);
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (hasAutoFetchedFromQuery.current) return;
    const walletFromQuery = getWalletFromQueryString().trim();

    if (!ETHEREUM_ADDRESS_REGEX.test(walletFromQuery)) return;

    hasAutoFetchedFromQuery.current = true;
    void fetchLoans(walletFromQuery);
  }, []);

  const handleFetch = async (event: FormEvent) => {
    event.preventDefault();

    const normalizedWallet = wallet.trim();
    if (!ETHEREUM_ADDRESS_REGEX.test(normalizedWallet)) {
      setError('Please enter a valid Ethereum wallet address.');
      setResult(null);
      return;
    }

    await fetchLoans(normalizedWallet);
  };

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_0%_0%,#0f3a68_0%,#081019_58%,#04070d_100%)] px-4 py-4 text-[#dce8f6] antialiased md:px-6 md:py-6">
      <main className="mx-auto max-w-[1280px]">
        <header className="flex items-end justify-between gap-4 max-[980px]:flex-col max-[980px]:items-start">
          <div>
            <h1 className="text-[clamp(1.4rem,3vw,2rem)] tracking-[0.01em]">
              Aave Loan Health Dashboard
            </h1>
            <p className="mt-1.5 text-[#9fb1c7]">
              Auto-fetched from wallet address using public blockchain data and price APIs.
            </p>
          </div>
        </header>

        <section className="mt-4 rounded-[18px] border border-[rgba(168,191,217,0.22)] bg-[linear-gradient(140deg,rgba(11,24,39,0.82),rgba(9,16,28,0.6))] p-4 backdrop-blur-[8px]">
          <form
            className="flex flex-wrap items-end gap-3 max-[980px]:items-stretch"
            onSubmit={handleFetch}
          >
            <label
              className="grid min-w-0 gap-[5px] text-[0.84rem] max-[980px]:w-full max-[980px]:max-w-full"
              htmlFor="wallet"
            >
              <span className="text-[#afc0d5]">Wallet address</span>
              <input
                className="h-9 w-full min-w-0 max-w-[460px] rounded-[10px] border border-[rgba(168,191,217,0.3)] bg-[rgba(4,9,16,0.7)] px-[10px] text-[#e8f2ff] outline-none focus:border-transparent focus:ring-2 focus:ring-[#3f7ad8] max-[980px]:max-w-full"
                id="wallet"
                type="text"
                value={wallet}
                onChange={(event) => setWallet(event.target.value)}
                placeholder="0x..."
                autoComplete="off"
                spellCheck={false}
              />
            </label>

            <button
              className="inline-flex h-[38px] items-center gap-2 rounded-[10px] border border-[rgba(168,191,217,0.35)] bg-[linear-gradient(135deg,#2f5eab,#2b4270)] px-[14px] font-semibold text-[#eff6ff] enabled:cursor-pointer disabled:cursor-progress disabled:opacity-80 max-[980px]:w-full max-[980px]:max-w-full"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <Wallet size={16} />}
              {isLoading ? 'Fetching loans...' : 'Fetch loans'}
            </button>
          </form>

          {error ? (
            <p className="mt-2 inline-flex items-center gap-2 text-[0.9rem] text-red-200">
              <AlertTriangle size={16} />
              {error}
            </p>
          ) : null}
        </section>

        {result ? (
          <>
            <article className="mt-3 grid gap-[5px] rounded-[18px] border border-[rgba(168,191,217,0.22)] bg-[linear-gradient(140deg,rgba(11,24,39,0.82),rgba(9,16,28,0.6))] px-4 py-[14px] backdrop-blur-[8px]">
              <p className="text-[0.79rem] text-[#9fb1c7]">Wallet</p>
              <p className="break-all text-[0.9rem] font-mono">{result.wallet}</p>
              <p className="text-[0.79rem] text-[#9fb1c7]">
                Found {result.loans.length} active loan position(s)
              </p>
              <p className="text-[0.79rem] text-[#9fb1c7]">
                Last updated: {new Date(result.lastUpdated).toLocaleString()}
              </p>
            </article>

            {result.loans.length > 0 ? (
              <>
                <nav className="mt-3 flex flex-wrap gap-2" aria-label="Loan positions">
                  {result.loans.map((loan, index) => (
                    <button
                      key={loan.id}
                      type="button"
                      className={`h-9 cursor-pointer rounded-[10px] border px-3 text-[#d9e6f7] ${
                        loan.id === selectedLoan?.id
                          ? 'border-[rgba(200,222,247,0.6)] bg-[linear-gradient(135deg,#355f9e,#24436f)]'
                          : 'border-[rgba(168,191,217,0.35)] bg-[rgba(8,18,30,0.82)]'
                      }`}
                      onClick={() => setSelectedLoanId(loan.id)}
                    >
                      Loan {index + 1}: {loan.marketName} · {loan.borrowed.symbol}
                    </button>
                  ))}
                </nav>

                <section className="mt-4 grid gap-4 [grid-template-columns:minmax(320px,0.95fr)_minmax(0,2fr)] max-[980px]:grid-cols-1">
                  <Card>
                    <CardHeader>
                      <h2 className="inline-flex items-center gap-2 text-base">
                        Position Snapshot <Info size={16} />
                      </h2>
                    </CardHeader>
                    <CardBody>
                      <StaticField
                        label="Borrowed asset"
                        value={`${fmtAmount(selectedLoan?.borrowed.amount ?? 0)} ${selectedLoan?.borrowed.symbol ?? ''}`}
                      />
                      <StaticField label="Market" value={selectedLoan?.marketName ?? '—'} />
                      <StaticField label="Debt (USD)" value={fmtUSD(computed.debt, 0)} />
                      <Divider />

                      <div className="grid min-w-0 gap-[5px] text-[0.84rem]">
                        <span className="text-[#afc0d5]">Supplied collateral assets</span>
                        <ul className="grid list-none gap-1.5">
                          {selectedLoan?.supplied.map((asset) => (
                            <li
                              key={`${asset.address}-${asset.symbol}`}
                              className="flex justify-between gap-[10px] rounded-[10px] border border-[rgba(168,191,217,0.2)] bg-[rgba(12,24,38,0.6)] px-[10px] py-2 max-[980px]:flex-col max-[980px]:items-start"
                            >
                              <span>{asset.symbol}</span>
                              <span>
                                {fmtAmount(asset.amount)} | {fmtUSD(asset.usdValue, 0)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <StaticField
                        label="Collateral value (USD)"
                        value={fmtUSD(computed.collateralUSD, 0)}
                      />
                      <Divider />

                      <TwoColumn>
                        <StaticField label="Max LTV (weighted)" value={fmtPct(computed.ltvMax)} />
                        <StaticField
                          label="Liquidation threshold (weighted)"
                          value={fmtPct(computed.lt)}
                        />
                      </TwoColumn>

                      <Divider />

                      <TwoColumn>
                        <StaticField
                          label="Supply APY (weighted)"
                          value={fmtPct(computed.rSupply)}
                        />
                        <StaticField label="Borrow APY" value={fmtPct(computed.rBorrow)} />
                      </TwoColumn>

                      <StaticField
                        label="Borrowed funds deploy APY"
                        value={fmtPct(computed.rDeploy)}
                        hint="Set from your strategy outside this dashboard."
                      />
                    </CardBody>
                  </Card>

                  <div className="grid gap-4">
                    <Card>
                      <CardHeader>
                        <h2 className="inline-flex items-center gap-2 text-base">
                          Status
                          <Badge tone={status.tone}>{status.label}</Badge>
                          {computed.healthFactor < 1.5 ? (
                            <AlertTriangle size={16} />
                          ) : (
                            <ShieldCheck size={16} />
                          )}
                        </h2>
                      </CardHeader>
                      <CardBody className="grid-cols-3 max-[980px]:grid-cols-1">
                        <KpiCard
                          title="Health Factor (HF)"
                          value={
                            Number.isFinite(computed.healthFactor)
                              ? computed.healthFactor.toFixed(2)
                              : '∞'
                          }
                          caption="Liquidation when HF < 1.0"
                        />
                        <KpiCard
                          title={`Liquidation Price (${computed.primaryCollateralSymbol})`}
                          value={
                            Number.isFinite(computed.liqPrice) ? fmtUSD(computed.liqPrice, 2) : '—'
                          }
                          caption={`Price drop to liq: ${fmtPct(clamp(computed.priceDropToLiq, 0, 1), 1)}`}
                        />
                        <KpiCard
                          title="Equity"
                          value={fmtUSD(computed.equity, 0)}
                          caption="Collateral − Debt"
                        />
                      </CardBody>
                    </Card>

                    <div className="grid grid-cols-2 gap-4 max-[980px]:grid-cols-1">
                      <Card>
                        <CardHeader>
                          <h2 className="inline-flex items-center gap-2 text-base">Main Metrics</h2>
                        </CardHeader>
                        <CardBody>
                          <Row label="Collateral value" value={fmtUSD(computed.collateralUSD, 0)} />
                          <Row label="Debt" value={fmtUSD(computed.debt, 0)} />
                          <Row label="LTV" value={fmtPct(computed.ltv)} />
                          <Row
                            label="Leverage (C/E)"
                            value={
                              Number.isFinite(computed.leverage)
                                ? `${computed.leverage.toFixed(2)}x`
                                : '∞'
                            }
                          />
                          <Row label="Borrow power used" value={fmtPct(computed.borrowPowerUsed)} />
                          <Row label="Borrow headroom" value={fmtUSD(computed.borrowHeadroom, 0)} />
                          <Divider />
                          <Row label="Liquidation threshold" value={fmtPct(computed.lt)} />
                          <Row label="LTV at liquidation" value={fmtPct(computed.ltvAtLiq)} />
                          <Row
                            label="Collateral buffer"
                            value={fmtUSD(computed.collateralBufferUSD, 0)}
                          />
                        </CardBody>
                      </Card>

                      <Card>
                        <CardHeader>
                          <h2 className="inline-flex items-center gap-2 text-base">
                            Carry / Net APY
                          </h2>
                        </CardHeader>
                        <CardBody>
                          <Row label="Supply APY" value={fmtPct(computed.rSupply)} />
                          <Row label="Borrow APY" value={fmtPct(computed.rBorrow)} />
                          <Row label="Deploy APY (optional)" value={fmtPct(computed.rDeploy)} />
                          <Divider />
                          <Row
                            label="Supply earnings (annual)"
                            value={fmtUSD(computed.supplyEarnUSD, 0)}
                          />
                          <Row
                            label="Borrow cost (annual)"
                            value={fmtUSD(computed.borrowCostUSD, 0)}
                          />
                          <Row
                            label="Deploy earnings (annual)"
                            value={fmtUSD(computed.deployEarnUSD, 0)}
                          />
                          <Divider />
                          <Row
                            label="Net earnings (annual)"
                            value={fmtUSD(computed.netEarnUSD, 0)}
                          />
                          <Row
                            label="Net APY (on equity)"
                            value={fmtPct(computed.netAPYOnEquity)}
                          />
                          <p className="text-[0.79rem] text-[#9fb1c7]">
                            Net APY is ROE: (supply + deploy − borrow) / equity.
                          </p>
                        </CardBody>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <h2 className="inline-flex items-center gap-2 text-base">
                          Monitoring Checklist
                        </h2>
                      </CardHeader>
                      <CardBody className="grid-cols-3 max-[980px]:grid-cols-1">
                        <ChecklistItem
                          title="Health Factor"
                          ok={!computed.alertHF}
                          detail="Keep HF comfortably above 1.0; many traders target 1.7-2.5+."
                        />
                        <ChecklistItem
                          title="LTV vs LT"
                          ok={!computed.alertLTV}
                          detail="As LTV approaches liquidation threshold, small price moves can liquidate you."
                        />
                        <ChecklistItem
                          title="Rates drift"
                          ok
                          detail="Borrow/supply APYs are variable; net carry can flip quickly during volatility."
                        />
                        <ChecklistItem
                          title="Stablecoin depeg"
                          ok
                          detail="USDC/USDT are usually close to $1, but depegs can distort debt value."
                        />
                        <ChecklistItem
                          title="Oracle / market"
                          ok
                          detail="Liquidations depend on oracle price; liquidity + slippage matters in crashes."
                        />
                        <ChecklistItem
                          title="Automation"
                          ok
                          detail="Consider alerts (HF, price, LTV) and an emergency delever playbook."
                        />
                      </CardBody>
                    </Card>

                    <Card>
                      <CardHeader>
                        <h2 className="inline-flex items-center gap-2 text-base">Sensitivity</h2>
                      </CardHeader>
                      <CardBody className="grid-cols-3 max-[980px]:grid-cols-1">
                        <KpiCard
                          title="Equity move for ±10% price"
                          value={
                            Number.isFinite(computed.leverage)
                              ? fmtPct(computed.equityMoveFor10Pct, 1)
                              : '—'
                          }
                          caption="Approx = leverage × 10%"
                        />
                        <KpiCard
                          title="Max borrow (by LTV)"
                          value={fmtUSD(computed.maxBorrowByLTV, 0)}
                          caption="Based on weighted collateral LTV"
                        />
                        <KpiCard
                          title="Collateral needed at HF=1"
                          value={fmtUSD(computed.collateralUSDAtLiq, 0)}
                          caption="= Debt / liquidation threshold"
                        />
                      </CardBody>
                    </Card>
                  </div>
                </section>
              </>
            ) : (
              <article className="mt-3 rounded-[18px] border border-[rgba(168,191,217,0.22)] bg-[linear-gradient(140deg,rgba(11,24,39,0.82),rgba(9,16,28,0.6))] p-4 backdrop-blur-[8px]">
                <p>No borrowed positions were found for this wallet on Aave V3 Ethereum.</p>
              </article>
            )}
          </>
        ) : null}

        <footer className="mt-[18px] text-[0.79rem] text-[#9fb1c7]">
          <p>
            Simplified monitor. Multi-collateral liquidation price is shown for the primary
            collateral asset only.
          </p>
        </footer>
      </main>
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-[18px] border border-[rgba(168,191,217,0.22)] bg-[linear-gradient(140deg,rgba(11,24,39,0.82),rgba(9,16,28,0.6))] backdrop-blur-[8px]">
      {children}
    </section>
  );
}

function CardHeader({ children }: { children: ReactNode }) {
  return <header className="px-[18px] pt-[18px]">{children}</header>;
}

function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid gap-3 px-[18px] pt-[14px] pb-[18px] ${className ?? ''}`.trim()}>
      {children}
    </div>
  );
}

function Divider() {
  return <hr className="my-0.5 h-px w-full border-0 bg-[rgba(168,191,217,0.2)]" />;
}

function TwoColumn({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  const toneClass =
    tone === 'positive'
      ? 'bg-green-600 text-green-50'
      : tone === 'warning'
        ? 'bg-amber-600 text-amber-50'
        : tone === 'danger'
          ? 'bg-red-600 text-red-50'
          : 'bg-slate-600 text-slate-50';
  return (
    <span className={`rounded-full px-2 py-[3px] text-[0.72rem] font-bold uppercase ${toneClass}`}>
      {children}
    </span>
  );
}

function StaticField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="grid min-w-0 gap-[5px] text-[0.84rem]">
      <span className="text-[#afc0d5]">{label}</span>
      <p className="text-[0.95rem] font-semibold text-[#e8f2ff]">{value}</p>
      {hint ? <p className="text-[0.79rem] text-[#9fb1c7]">{hint}</p> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-[0.92rem]">
      <span className="text-[#9fb1c7]">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function ChecklistItem({ title, detail, ok }: { title: string; detail: string; ok: boolean }) {
  return (
    <article className="rounded-[14px] border border-[rgba(168,191,217,0.18)] bg-[rgba(14,25,39,0.6)] p-3">
      <div className="flex items-center justify-between gap-[10px]">
        <h3 className="text-[0.94rem]">{title}</h3>
        <Badge tone={ok ? 'positive' : 'danger'}>{ok ? 'OK' : 'Watch'}</Badge>
      </div>
      <p className="text-[0.79rem] text-[#9fb1c7]">{detail}</p>
    </article>
  );
}

function KpiCard({ title, value, caption }: { title: string; value: string; caption: string }) {
  return (
    <article className="rounded-[14px] border border-[rgba(168,191,217,0.18)] bg-[rgba(14,25,39,0.6)] p-3">
      <p className="text-[0.79rem] text-[#9fb1c7]">{title}</p>
      <p className="my-1 text-[1.7rem] font-semibold">{value}</p>
      <p className="text-[0.79rem] text-[#9fb1c7]">{caption}</p>
    </article>
  );
}
