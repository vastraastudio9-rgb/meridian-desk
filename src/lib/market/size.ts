export function positionSize(entry: number, stop: number, riskUsd: number) {
  const dist = Math.abs(entry - stop);
  if (!Number.isFinite(entry) || !Number.isFinite(stop) || dist <= 0) {
    return { qty: 0, notional: 0, dist: 0 };
  }
  const qty = riskUsd / dist;
  return { qty, notional: qty * entry, dist };
}

export function formatQty(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m.toLocaleString("en-US", { maximumFractionDigits: m >= 100 ? 0 : 2 })}M`;
  }
  if (n >= 10_000) {
    return `${(n / 1_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k`;
  }
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 0.01) return n.toFixed(3);
  return n.toPrecision(3);
}
