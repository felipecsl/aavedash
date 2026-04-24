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
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Stat } from './Stat';
import { fmtUsd } from './chartFormat';
import type { PortfolioSnapshot } from '../api/aaveMonitor';

type HistoryWindow = '24h' | '7d' | '30d' | '90d' | '180d';

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
  grid: 'rgba(139, 158, 179, 0.15)',
  axis: 'rgba(139, 158, 179, 0.85)',
};

const CHART_STYLE = {
  background: 'transparent',
  fontSize: 12,
  fontFamily: 'inherit',
};

export function PortfolioHistoryCard({
  samples,
  currentTimeMs,
}: {
  samples: PortfolioSnapshot[];
  currentTimeMs: number;
}) {
  const [windowValue, setWindowValue] = useState<HistoryWindow>('30d');

  const filtered = useMemo(() => {
    const selected = HISTORY_WINDOWS.find((entry) => entry.value === windowValue);
    if (!selected) return samples;
    const cutoff = currentTimeMs - selected.durationMs;
    return samples.filter((s) => s.timestamp >= cutoff);
  }, [currentTimeMs, samples, windowValue]);

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

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Portfolio History</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Total assets and total debt snapshotted on each poll.
          </p>
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
      </CardHeader>
      <CardContent className="grid gap-4">
        {filtered.length >= 2 ? (
          <>
            <div className="grid gap-1 sm:grid-cols-3">
              <Stat label="Total Assets" value={fmtUsd(latest?.totalAssets ?? 0)} />
              <Stat label="Total Debt" value={fmtUsd(latest?.totalDebt ?? 0)} />
              <Stat label="Net Worth" value={fmtUsd(latest?.netWorth ?? 0)} />
            </div>

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
          </>
        ) : (
          <div className="rounded-lg border border-border bg-accent px-4 py-5 text-sm text-muted-foreground">
            No portfolio history yet — data accrues on each poll.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
