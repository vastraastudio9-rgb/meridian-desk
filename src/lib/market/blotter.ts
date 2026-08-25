import type { MarketRow, PaperFill, Side } from "./types";
import type { Interval } from "./universe";
import {
  DEFAULT_RISK,
  effectiveRiskUsd,
  planLevels,
  riskHalt,
  sizeForRisk,
  type RiskParams,
} from "@/lib/risk/params";

export const GRACE_MS = 90_000;

const BAR_MS: Record<Interval, number> = {
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
};

const TIME_BARS: Record<Interval, number> = {
  "15m": 32,
  "1h": 24,
  "4h": 18,
  "1d": 10,
};

export function newFillId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function openFill(
  row: MarketRow,
  interval: Interval,
  params: RiskParams = DEFAULT_RISK,
  equity = 10_000,
  venue: "paper" | "live" = "paper",
): PaperFill | null {
  if (row.signal.side === "wait") return null;
  const levels = planLevels(row, params);
  const riskUsd = effectiveRiskUsd(equity, params);
  const sized = sizeForRisk(
    levels.entry,
    levels.stop,
    riskUsd,
    equity,
    params.maxNotionalPct,
  );
  if (sized.qty <= 0) return null;
  return {
    id: newFillId(),
    symbol: row.symbol,
    base: row.base,
    side: row.signal.side,
    interval,
    entry: levels.entry,
    stop: levels.stop,
    target: levels.target,
    qty: sized.qty,
    riskUsd: sized.riskUsd,
    rewardR: params.rewardR,
    openedAt: Date.now(),
    closedAt: null,
    result: "open",
    r: null,
    pnlUsd: null,
    venue,
    liveOrderId: null,
    liveError: null,
  };
}

export function resolveAgainstBar(
  fill: PaperFill,
  bar: { h: number; l: number; c: number },
  now = Date.now(),
): PaperFill {
  if (fill.result !== "open") return fill;
  if (now - fill.openedAt < GRACE_MS) return fill;

  const reward = fill.rewardR && fill.rewardR > 0 ? fill.rewardR : 1.85;
  const stopHit = fill.side === "long" ? bar.l <= fill.stop : bar.h >= fill.stop;
  const targetHit = fill.side === "long" ? bar.h >= fill.target : bar.l <= fill.target;
  if (stopHit) {
    return {
      ...fill,
      result: "loss",
      r: -1,
      pnlUsd: -fill.riskUsd,
      closedAt: now,
    };
  }
  if (targetHit) {
    return {
      ...fill,
      result: "win",
      r: reward,
      pnlUsd: Math.round(fill.riskUsd * reward * 100) / 100,
      closedAt: now,
    };
  }

  const maxAge = BAR_MS[fill.interval] * TIME_BARS[fill.interval];
  if (now - fill.openedAt >= maxAge) {
    const pnl =
      fill.side === "long"
        ? (bar.c - fill.entry) * fill.qty
        : (fill.entry - bar.c) * fill.qty;
    const r = fill.riskUsd > 0 ? Math.round((pnl / fill.riskUsd) * 100) / 100 : 0;
    return {
      ...fill,
      result: pnl >= 0 ? "win" : "loss",
      r,
      pnlUsd: Math.round(pnl * 100) / 100,
      closedAt: now,
    };
  }
  return fill;
}

export function markBlotter(fills: PaperFill[], markets: MarketRow[], now = Date.now()): PaperFill[] {
  const bySymbol = new Map(markets.map((m) => [m.symbol, m]));
  return fills.map((fill) => {
    if (fill.result !== "open") return fill;
    const row = bySymbol.get(fill.symbol);
    const last = row?.candles[row.candles.length - 1];
    if (!last) return fill;
    const bar = {
      h: Math.max(last.h, row?.price ?? last.c),
      l: Math.min(last.l, row?.price ?? last.c),
      c: row?.price ?? last.c,
    };
    return resolveAgainstBar(fill, bar, now);
  });
}

export function blotterStats(fills: PaperFill[]) {
  const closed = fills.filter((f) => f.result !== "open");
  const open = fills.filter((f) => f.result === "open");
  const wins = closed.filter((f) => f.result === "win").length;
  const losses = closed.filter((f) => f.result === "loss").length;
  const r = closed.reduce((sum, f) => sum + (f.r ?? 0), 0);
  return {
    open: open.length,
    closed: closed.length,
    wins,
    losses,
    r: Math.round(r * 100) / 100,
    winRate: closed.length >= 3 ? Math.round((wins / closed.length) * 100) : null,
  };
}

export function fillKey(symbol: string, _side?: Exclude<Side, "wait">, _interval?: Interval) {
  return symbol;
}

export function canBook(
  fills: PaperFill[],
  cash: number,
  equity: number,
  symbol: string,
  params: RiskParams = DEFAULT_RISK,
): { ok: boolean; reason: string } {
  const halt = riskHalt(fills, params);
  if (!halt.ok) return halt;
  const riskUsd = effectiveRiskUsd(equity, params);
  if (cash < riskUsd) return { ok: false, reason: "Cash below risk unit" };
  const open = fills.filter((f) => f.result === "open");
  if (open.length >= params.maxOpen) {
    return { ok: false, reason: `Max ${params.maxOpen} open` };
  }
  if (open.some((f) => f.symbol === symbol)) return { ok: false, reason: "Already in" };
  return { ok: true, reason: "ok" };
}
