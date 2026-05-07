import { healthLabel, type PortfolioSummary } from '@aave-monitor/core';
import { Eye, EyeOff } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { MetricTooltip } from '../MetricTooltip';
import { cn } from '../../lib/utils';
import { fmtPct, fmtUSD, toBadgeVariant } from '../../lib/formatters';
import { SensitiveValue } from './privacy';

export function PortfolioSummaryCard({
  hideSensitiveValues,
  portfolio,
  onTogglePrivacy,
}: {
  hideSensitiveValues: boolean;
  portfolio: PortfolioSummary;
  onTogglePrivacy: () => void;
}) {
  const dailyNetEarn = portfolio.totalNetEarn / 365;

  return (
    <Card className="mt-4">
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-4">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <div>
              <MetricTooltip description="Total debt is the sum of borrowed USD value across all active loan positions.">
                <p className="text-xs text-muted-foreground">Total Debt</p>
                <p
                  className={cn(
                    'text-4xl font-bold tracking-tight tabular-nums',
                    hideSensitiveValues && 'text-foreground',
                  )}
                >
                  <SensitiveValue hidden={hideSensitiveValues}>
                    {fmtUSD(portfolio.totalDebt, 0)}
                  </SensitiveValue>
                </p>
              </MetricTooltip>
            </div>
            <MetricTooltip
              description="Total assets are risk collateral from loan positions plus USD value held in Morpho vault deposits."
              className="text-left"
            >
              <div>
                <p className="text-xs text-muted-foreground">Total Assets</p>
                <p
                  className={cn(
                    'text-xl font-semibold tabular-nums',
                    hideSensitiveValues && 'text-foreground',
                  )}
                >
                  <SensitiveValue hidden={hideSensitiveValues}>
                    {fmtUSD(portfolio.totalAssets, 0)}
                  </SensitiveValue>
                </p>
              </div>
            </MetricTooltip>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              onClick={onTogglePrivacy}
              aria-label={hideSensitiveValues ? 'Show sensitive values' : 'Hide sensitive values'}
              aria-pressed={hideSensitiveValues}
              title={hideSensitiveValues ? 'Show sensitive values' : 'Hide sensitive values'}
            >
              {hideSensitiveValues ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <MetricTooltip description="HF is the average of finite per-loan health factors, with each loan calculated as risk collateral times liquidation threshold divided by debt.">
              <Badge
                variant={toBadgeVariant(healthLabel(portfolio.averageHealthFactor).tone)}
                className="text-sm"
              >
                HF{' '}
                {Number.isFinite(portfolio.averageHealthFactor)
                  ? portfolio.averageHealthFactor.toFixed(2)
                  : '∞'}
              </Badge>
            </MetricTooltip>
            <MetricTooltip description="Net APY is annual net earnings divided by net worth after adding loan supply income and vault income, then subtracting borrow cost.">
              <Badge
                variant={
                  portfolio.portfolioNetApy >= 0
                    ? 'positive'
                    : portfolio.portfolioNetApy > -0.03
                      ? 'warning'
                      : 'destructive'
                }
                className="text-sm"
              >
                Net APY {fmtPct(portfolio.portfolioNetApy)}
              </Badge>
            </MetricTooltip>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <PortfolioMetric
            description="Risk collateral is the sum of supplied collateral USD value across loan positions only."
            label="Risk collateral"
            value={fmtUSD(portfolio.totalRiskCollateral, 0)}
            hidden={hideSensitiveValues}
          />
          <PortfolioMetric
            description="Vault deposits are the sum of Morpho vault position values in USD."
            label="Vault deposits"
            value={fmtUSD(portfolio.totalVaultAssets, 0)}
            hidden={hideSensitiveValues}
          />
          <PortfolioMetric
            description="Net worth is loan collateral minus loan debt, plus Morpho vault deposit value."
            label="Net worth"
            value={fmtUSD(portfolio.totalNetWorth, 0)}
            hidden={hideSensitiveValues}
          />
          <PortfolioMetric
            description="Net earnings are annual loan supply income plus vault income minus annual borrow cost."
            label="Net earnings"
            value={`${fmtUSD(portfolio.totalNetEarn, 0)}/yr`}
            hidden={hideSensitiveValues}
          />
          <PortfolioMetric
            description="Net earnings per day are estimated by dividing annual net earnings by 365."
            label="Net earnings per day"
            value={`${fmtUSD(dailyNetEarn, 2)}/day`}
            hidden={hideSensitiveValues}
          />
          <PortfolioMetric
            description="Net borrow cost is the gross annual borrow interest cost across loan positions before supply or vault income offsets."
            label="Net borrow cost"
            value={`${fmtUSD(portfolio.totalBorrowCost, 0)}/yr`}
            hidden={hideSensitiveValues}
          />
          <PortfolioMetric
            description="Accrued interest is the sum of outstanding loan accrued interest reported by the upstream protocol APIs, where available."
            label="Accrued interest"
            value={fmtUSD(portfolio.totalAccruedBorrowInterest, 2)}
            hidden={hideSensitiveValues}
          />
          <PortfolioMetric
            description="Borrow power used is total debt divided by the sum of each loan's collateral value times its weighted max LTV."
            label="Borrow power used"
            value={fmtPct(portfolio.borrowPowerUsed)}
          />
          <PortfolioMetric
            description="Supply APY is annual loan supply income plus vault income divided by total assets."
            label="Supply APY"
            value={fmtPct(portfolio.averageSupplyApy)}
          />
          <PortfolioMetric
            description="Borrow APY is annual borrow cost divided by total debt."
            label="Borrow APY"
            value={fmtPct(portfolio.averageBorrowApy)}
          />
          <PortfolioMetric
            description="Net APY on debt is annual net earnings divided by total debt."
            label="Net APY (debt)"
            value={fmtPct(portfolio.portfolioNetApyOnDebt)}
          />
          <MetricTooltip description="Repay coverage is wallet-held borrowed-asset USD value divided by total debt.">
            Repay coverage{' '}
            <span
              className={cn(
                'font-semibold tabular-nums',
                portfolio.repayCoverage >= 0.1
                  ? 'text-positive'
                  : portfolio.repayCoverage >= 0.05
                    ? 'text-warning'
                    : 'text-destructive',
              )}
            >
              {fmtPct(portfolio.repayCoverage)}
            </span>
          </MetricTooltip>
        </div>
      </CardContent>
    </Card>
  );
}

function PortfolioMetric({
  description,
  hidden = false,
  label,
  value,
}: {
  description: string;
  hidden?: boolean;
  label: string;
  value: string;
}) {
  return (
    <MetricTooltip description={description}>
      {label}{' '}
      <SensitiveValue hidden={hidden} className="font-semibold tabular-nums text-foreground">
        {value}
      </SensitiveValue>
    </MetricTooltip>
  );
}
