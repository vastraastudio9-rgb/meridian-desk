import type { MarketRow, PaperFill } from "./types";

export const STARTING_CASH = 10_000;

export function unrealizedPnl(fill: PaperFill, mark: number) {
  if (!Number.isFinite(mark)) return 0;
  return fill.side === "long"
    ? (mark - fill.entry) * fill.qty
    : (fill.entry - mark) * fill.qty;
}

export function deskAccount(
  fills: PaperFill[],
  markets: MarketRow[],
  cash: number,
) {
  const bySymbol = new Map(markets.map((m) => [m.symbol, m.price]));
  let unreal = 0;
  for (const fill of fills) {
    if (fill.result !== "open") continue;
    const mark = bySymbol.get(fill.symbol) ?? fill.entry;
    unreal += unrealizedPnl(fill, mark);
  }
  const realized = fills
    .filter((f) => f.result !== "open")
    .reduce((sum, f) => sum + (f.pnlUsd ?? (f.r ?? 0) * f.riskUsd), 0);
  const equity = cash + unreal;
  return {
    cash: Math.round(cash * 100) / 100,
    unreal: Math.round(unreal * 100) / 100,
    realized: Math.round(realized * 100) / 100,
    equity: Math.round(equity * 100) / 100,
  };
}
