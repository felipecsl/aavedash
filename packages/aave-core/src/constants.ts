import type { AaveMarket } from './types.js';

export const AAVE_MARKETS: readonly AaveMarket[] = [
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

export const COINGECKO_IDS_BY_SYMBOL: Record<string, string> = {
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

export const USER_RESERVES_QUERY = `
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

export const DEFAULT_R_DEPLOY = 0.1125;

export const ETHEREUM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
