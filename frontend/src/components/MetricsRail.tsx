import type { MetricsSummary } from "@/lib/api";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-3 border-r border-void-line last:border-r-0">
      <span className="font-display italic text-xs text-mist tracking-wide">{label}</span>
      <span className="font-mono text-lg text-parchment tabular-nums">{value}</span>
    </div>
  );
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function MetricsRail({ metrics, concurrency, activeCount }: { metrics: MetricsSummary; concurrency: number; activeCount: number }) {
  const totalTokens = metrics.today.tokensIn + metrics.today.tokensOut;
  return (
    <div className="flex flex-wrap items-stretch border-b border-void-line bg-void-soft/60">
      <Stat label="Tokens · today" value={fmtTokens(totalTokens)} />
      <Stat label="Tokens · 7d" value={fmtTokens(metrics.week.tokensIn + metrics.week.tokensOut)} />
      <Stat label="Tokens · 30d" value={fmtTokens(metrics.month.tokensIn + metrics.month.tokensOut)} />
      <Stat label="Cost · today" value={`$${metrics.today.costUsd.toFixed(3)}`} />
      <Stat label="Tasks done · today" value={String(metrics.today.tasksDone)} />
      <Stat label="Workers" value={`${activeCount} / ${concurrency}`} />
    </div>
  );
}
