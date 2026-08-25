import type { MarketRow, PaperFill } from "@/lib/market/types";
import { positionSize } from "@/lib/market/size";

export type RiskParams = {
  riskUsd: number;
  riskPct: number;
  maxOpen: number;
  dailyLossUsd: number;
  confMin: number;
  rewardR: number;
  atrStop: number;
  maxLossStreak: number;
  requireAlign: boolean;
  blockChop: boolean;
  maxNotionalPct: number;
};

export const DEFAULT_RISK: RiskParams = {
  riskUsd: 100,
  riskPct: 1.5,
  maxOpen: 5,
  dailyLossUsd: 400,
  confMin: 52,
  rewardR: 1.85,
  atrStop: 1.6,
  maxLossStreak: 3,
  requireAlign: true,
  blockChop: true,
  maxNotionalPct: 20,
};

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function clampRisk(partial: Partial<RiskParams> | undefined): RiskParams {
  const p = partial ?? {};
  return {
    riskUsd: clamp(p.riskUsd ?? DEFAULT_RISK.riskUsd, 10, 10_000),
    riskPct: clamp(p.riskPct ?? DEFAULT_RISK.riskPct, 0.1, 10),
    maxOpen: Math.round(clamp(p.maxOpen ?? DEFAULT_RISK.maxOpen, 1, 12)),
    dailyLossUsd: clamp(p.dailyLossUsd ?? DEFAULT_RISK.dailyLossUsd, 50, 20_000),
    confMin: Math.round(clamp(p.confMin ?? DEFAULT_RISK.confMin, 30, 90)),
    rewardR: clamp(p.rewardR ?? DEFAULT_RISK.rewardR, 1, 4),
    atrStop: clamp(p.atrStop ?? DEFAULT_RISK.atrStop, 0.8, 4),
    maxLossStreak: Math.round(clamp(p.maxLossStreak ?? DEFAULT_RISK.maxLossStreak, 1, 10)),
    requireAlign: p.requireAlign ?? true,
    blockChop: p.blockChop ?? true,
    maxNotionalPct: clamp(p.maxNotionalPct ?? DEFAULT_RISK.maxNotionalPct, 5, 80),
  };
}

export function effectiveRiskUsd(equity: number, params: RiskParams) {
  const fromPct = Math.max(10, equity * (params.riskPct / 100));
  return Math.min(params.riskUsd, fromPct);
}

export function planLevels(row: MarketRow, params: RiskParams) {
  const entry = row.signal.entry || row.price;
  const atr = row.signal.atr;
  const fallback = Math.abs(row.signal.entry - row.signal.stop);
  const dist =
    atr != null && atr > 0
      ? atr * params.atrStop
      : fallback > 0
        ? fallback * (params.atrStop / 1.6)
        : Math.abs(entry) * 0.018 * (params.atrStop / 1.6);
  const stop = row.signal.side === "short" ? entry + dist : entry - dist;
  const target =
    row.signal.side === "short"
      ? entry - dist * params.rewardR
      : entry + dist * params.rewardR;
  return { entry, stop, target, dist };
}

export function sizeForRisk(
  entry: number,
  stop: number,
  riskUsd: number,
  equity: number,
  maxNotionalPct: number,
) {
  const sized = positionSize(entry, stop, riskUsd);
  const cap = Math.max(0, equity * (maxNotionalPct / 100));
  if (sized.notional <= cap || cap <= 0 || entry <= 0) {
    return { ...sized, riskUsd };
  }
  const qty = cap / entry;
  const actualRisk = qty * sized.dist;
  return { qty, notional: cap, dist: sized.dist, riskUsd: actualRisk };
}

export function startOfLocalDay(now = Date.now()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function realizedToday(fills: PaperFill[], now = Date.now()) {
  const start = startOfLocalDay(now);
  return fills
    .filter((f) => f.result !== "open" && f.closedAt != null && f.closedAt >= start)
    .reduce((sum, f) => sum + (f.pnlUsd ?? 0), 0);
}

export function lossStreak(fills: PaperFill[]) {
  const closed = fills
    .filter((f) => f.result !== "open")
    .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));
  let n = 0;
  for (const fill of closed) {
    if (fill.result === "loss") n += 1;
    else break;
  }
  return n;
}

export function riskHalt(
  fills: PaperFill[],
  params: RiskParams,
  now = Date.now(),
): { ok: boolean; reason: string } {
  const day = realizedToday(fills, now);
  if (day <= -params.dailyLossUsd) {
    return { ok: false, reason: `Daily loss ${day.toFixed(0)} hits cap` };
  }
  const streak = lossStreak(fills);
  if (streak >= params.maxLossStreak) {
    return { ok: false, reason: `${streak} losses in a row — pause` };
  }
  return { ok: true, reason: "ok" };
}
