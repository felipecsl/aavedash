import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Stat } from './Stat';
import { fmtUsd } from './chartFormat';
import type { PortfolioSnapshot } from '../api/aaveMonitor';
import { SensitiveBlock, SensitiveValue } from './dashboard/privacy';
import type { BorrowRateSample } from './ReserveCharts';

type HistoryWindow = '24h' | '7d' | '30d' | '90d' | '180d';
type HistoryTab = 'portfolio' | 'borrowApr';

const HISTORY_WINDOWS: Array<{ value: HistoryWindow; label: string; durationMs: number }> = [
  { value: '24h', label: '24h', durationMs: 24 * 60 * 60 * 1000 },
  { value: '7d', label: '7d', durationMs: 7 * 24 * 60 * 60 * 1000 },
  { value: '30d', label: '30d', durationMs: 30 * 24 * 60 * 60 * 1000 },
  { value: '90d', label: '90d', durationMs: 90 * 24 * 60 * 60 * 1000 },
  { value: '180d', label: '6m', durationMs: 180 * 24 * 60 * 60 * 1000 },
];

const COLORS = {
  assets: '#5cd3a8',
  debt: '#e255bc',
  borrow: '#f0b44c',
  average: '#8b9eb3',
  grid: 'rgba(139, 158, 179, 0.15)',
  axis: 'rgba(139, 158, 179, 0.85)',
};

const CHART_STYLE = {
  background: 'transparent',
  fontSize: 12,
  fontFamily: 'inherit',
};

function fmtPct(value: number, digits = 2): string {
  const scale = 10 ** digits;
  const truncated = Math.trunc(value * 100 * scale) / scale;
  return `${truncated.toFixed(digits)}%`;
}

export function PortfolioHistoryCard({
  hideSensitiveValues,
  samples,
  borrowRateSamples,
  borrowPositionCount,
  currentTimeMs,
}: {
  hideSensitiveValues: boolean;
  samples: PortfolioSnapshot[];
  borrowRateSamples: BorrowRateSample[];
  borrowPositionCount: number;
  currentTimeMs: number;
}) {
  const [windowValue, setWindowValue] = useState<HistoryWindow>('30d');
  const [activeTab, setActiveTab] = useState<HistoryTab>('portfolio');

  const filtered = useMemo(() => {
    const selected = HISTORY_WINDOWS.find((entry) => entry.value === windowValue);
    if (!selected) return samples;
    const cutoff = currentTimeMs - selected.durationMs;
    return samples.filter((s) => s.timestamp >= cutoff);
  }, [currentTimeMs, samples, windowValue]);

  const filteredBorrowRateSamples = useMemo(() => {
    const selected = HISTORY_WINDOWS.find((entry) => entry.value === windowValue);
    if (!selected) return borrowRateSamples;
    const cutoff = currentTimeMs - selected.durationMs;
    return borrowRateSamples.filter((sample) => {
      const timestamp = new Date(sample.timestamp).getTime();
      return Number.isFinite(timestamp) && timestamp >= cutoff;
    });
  }, [borrowRateSamples, currentTimeMs, windowValue]);

  const { data, maxValue, latest } = useMemo(() => {
    if (filtered.length === 0) {
      return { data: [], maxValue: 1, latest: null as PortfolioSnapshot | null };
    }
    const points = filtered.map((s) => ({
      timestamp: s.timestamp,
      totalAssets: s.totalAssets,
      totalDebt: s.totalDebt,
      netWorth: s.netWorth,
    }));
    const max = Math.max(...points.map((p) => Math.max(p.totalAssets, p.totalDebt)), 1);
    return {
      data: points,
      maxValue: max * 1.1,
      latest: filtered[filtered.length - 1] ?? null,
    };
  }, [filtered]);

  const {
    data: borrowRateData,
    averageRate,
    lastRate,
    maxRate,
  } = useMemo(() => {
    if (filteredBorrowRateSamples.length === 0) {
      return {
        data: [],
        averageRate: 0,
        lastRate: 0,
        maxRate: 0.02,
      };
    }

    const average =
      filteredBorrowRateSamples.reduce((sum, sample) => sum + sample.variableBorrowRate, 0) /
      filteredBorrowRateSamples.length;
    const last = filteredBorrowRateSamples.at(-1)?.variableBorrowRate ?? 0;
    const max = Math.max(...filteredBorrowRateSamples.map((s) => s.variableBorrowRate), 0.02);

    return {
      data: filteredBorrowRateSamples.map((sample) => ({
        timestamp: new Date(sample.timestamp).getTime(),
        borrowRate: sample.variableBorrowRate,
      })),
      averageRate: average,
      lastRate: last,
      maxRate: max * 1.1,
    };
  }, [filteredBorrowRateSamples]);

  const borrowRateYTicks = useMemo(() => {
    const step = maxRate / 4;
    return Array.from({ length: 5 }, (_, i) => Math.round(i * step * 10000) / 10000);
  }, [maxRate]);

  const xTickFormatter = useMemo(() => {
    if (data.length < 2) return (v: number) => String(v);
    const spanMs = data[data.length - 1]!.timestamp - data[0]!.timestamp;
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (spanMs <= oneDayMs) {
      return (v: number) =>
        new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return (v: number) => new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric' });
  }, [data]);

  const borrowRateXTickFormatter = useMemo(() => {
    if (borrowRateData.length < 2) return (v: number) => String(v);
    const spanMs =
      borrowRateData[borrowRateData.length - 1]!.timestamp - borrowRateData[0]!.timestamp;
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (spanMs <= oneDayMs) {
      return (v: number) =>
        new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return (v: number) => new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric' });
  }, [borrowRateData]);

  const description =
    activeTab === 'portfolio'
      ? 'Total assets and total debt snapshotted on each poll.'
      : 'Debt-weighted borrow APR history combined across all open loan positions.';

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Portfolio History</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="grid justify-items-end gap-2">
          <div className="flex rounded-lg border border-border bg-secondary p-1">
            <Button
              type="button"
              size="sm"
              variant={activeTab === 'portfolio' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('portfolio')}
            >
              Assets & Debt
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeTab === 'borrowApr' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('borrowApr')}
            >
              Borrow APR
            </Button>
          </div>
          <div className="flex flex-wrap justify-end gap-1">
            {HISTORY_WINDOWS.map((entry) => (
              <Button
                key={entry.value}
                type="button"
                size="sm"
                variant={windowValue === entry.value ? 'default' : 'secondary'}
                onClick={() => setWindowValue(entry.value)}
              >
                {entry.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {activeTab === 'portfolio' && filtered.length >= 2 ? (
          <>
            <div className="grid gap-1 sm:grid-cols-3">
              <Stat
                label="Total Assets"
                value={
                  <SensitiveValue hidden={hideSensitiveValues}>
                    {fmtUsd(latest?.totalAssets ?? 0)}
                  </SensitiveValue>
                }
              />
              <Stat
                label="Total Debt"
                value={
                  <SensitiveValue hidden={hideSensitiveValues}>
                    {fmtUsd(latest?.totalDebt ?? 0)}
                  </SensitiveValue>
                }
              />
              <Stat
                label="Net Worth"
                value={
                  <SensitiveValue hidden={hideSensitiveValues}>
                    {fmtUsd(latest?.netWorth ?? 0)}
                  </SensitiveValue>
                }
              />
            </div>

            <SensitiveBlock hidden={hideSensitiveValues}>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart
                  data={data}
                  style={CHART_STYLE}
                  margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="5 5" stroke={COLORS.grid} vertical={false} />
                  <XAxis
                    dataKey="timestamp"
                    type="number"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={xTickFormatter}
                    tick={{ fill: COLORS.axis, fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: COLORS.grid }}
                    minTickGap={60}
                  />
                  <YAxis
                    domain={[0, maxValue]}
                    tickFormatter={(v) => fmtUsd(v)}
                    tick={{ fill: COLORS.axis, fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={80}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const ts = payload[0]?.payload?.timestamp as number | undefined;
                      return (
                        <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
                          {ts && (
                            <p className="mb-1 font-medium text-muted-foreground">
                              {new Date(ts).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          )}
                          {payload.map((entry) => (
                            <p
                              key={entry.name}
                              style={{ color: entry.color }}
                              className="font-semibold"
                            >
                              {entry.name}: {fmtUsd(Number(entry.value ?? 0))}
                            </p>
                          ))}
                        </div>
                      );
                    }}
                    cursor={{ stroke: 'rgba(139, 158, 179, 0.4)', strokeWidth: 1 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: COLORS.axis }} />
                  <Line
                    type="monotone"
                    dataKey="totalAssets"
                    name="Total Assets"
                    stroke={COLORS.assets}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, fill: COLORS.assets, stroke: '#0a1220', strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="totalDebt"
                    name="Total Debt"
                    stroke={COLORS.debt}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, fill: COLORS.debt, stroke: '#0a1220', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </SensitiveBlock>
          </>
        ) : activeTab === 'portfolio' ? (
          <div className="rounded-lg border border-border bg-accent px-4 py-5 text-sm text-muted-foreground">
            No portfolio history yet — data accrues on each poll.
          </div>
        ) : filteredBorrowRateSamples.length >= 2 ? (
          <>
            <div className="grid gap-1 sm:grid-cols-3">
              <Stat label="Latest APR" value={fmtPct(lastRate)} />
              <Stat label="Average APR" value={fmtPct(averageRate)} />
              <Stat label="Open Positions" value={borrowPositionCount.toLocaleString()} />
            </div>

            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={borrowRateData}
                style={CHART_STYLE}
                margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
              >
                <CartesianGrid strokeDasharray="5 5" stroke={COLORS.grid} vertical={false} />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={borrowRateXTickFormatter}
                  tick={{ fill: COLORS.axis, fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: COLORS.grid }}
                  minTickGap={60}
                />
                <YAxis
                  domain={[0, maxRate]}
                  tickFormatter={(v) => fmtPct(v, 0)}
                  ticks={borrowRateYTicks}
                  tick={{ fill: COLORS.axis, fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0];
                    const ts = point?.payload?.timestamp as number | undefined;
                    return (
                      <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
                        {ts && (
                          <p className="mb-1 font-medium text-muted-foreground">
                            {new Date(ts).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                        <p style={{ color: COLORS.borrow }} className="font-semibold">
                          Borrow APR: {fmtPct(Number(point?.value ?? 0))}
                        </p>
                      </div>
                    );
                  }}
                  cursor={{ stroke: 'rgba(139, 158, 179, 0.4)', strokeWidth: 1 }}
                />
                <ReferenceLine
                  y={averageRate}
                  stroke={COLORS.average}
                  strokeDasharray="6 5"
                  label={{
                    value: `Avg ${fmtPct(averageRate)}`,
                    position: 'insideTopRight',
                    fill: 'rgba(226, 236, 244, 0.65)',
                    fontSize: 11,
                  }}
                />
                <Line
                  type="natural"
                  dataKey="borrowRate"
                  name="Borrow APR"
                  stroke={COLORS.borrow}
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                  activeDot={{ r: 5, fill: COLORS.borrow, stroke: '#0a1220', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </>
        ) : (
          <div className="rounded-lg border border-border bg-accent px-4 py-5 text-sm text-muted-foreground">
            Combined borrow APR history needs at least two samples from open loan positions. Keep
            the dashboard running and refreshing to build the chart over time.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
