import type { MarketRow, MarketSnapshot } from "@/lib/market/types";
import { DEFAULT_RISK, type RiskParams } from "@/lib/risk/params";

export function riskCheck(
  row: MarketRow,
  params: RiskParams = DEFAULT_RISK,
): { ok: boolean; reason: string } {
  const { signal, stats } = row;
  if (signal.side === "wait") {
    return { ok: false, reason: "No setup" };
  }
  if (signal.confidence < params.confMin) {
    return { ok: false, reason: `Confidence ${signal.confidence} below ${params.confMin}` };
  }
  if (params.blockChop && row.chop) {
    return { ok: false, reason: "Chop — ATR too thin" };
  }
  if (params.requireAlign && row.alignState === "against") {
    const higher = (row.higherInterval ?? "htf").toUpperCase();
    return { ok: false, reason: `Against ${higher} ${row.higherSide}` };
  }
  if (
    signal.confidence < 70 &&
    stats.closed >= 5 &&
    stats.winRate != null &&
    stats.winRate < 18
  ) {
    return { ok: false, reason: `Paper hit ${stats.winRate}% — risk passed` };
  }
  const htfNote =
    row.alignState === "aligned" && row.higherInterval
      ? ` · ${row.higherInterval} aligned`
      : row.alignState === "pending" && row.higherInterval
        ? ` · ${row.higherInterval} pending`
        : "";
  return {
    ok: true,
    reason: `${signal.side} · conf ${signal.confidence}${htfNote}`,
  };
}

export function approvedCalls(
  markets: MarketRow[],
  params: RiskParams = DEFAULT_RISK,
): MarketRow[] {
  return markets
    .filter((row) => riskCheck(row, params).ok)
    .sort((a, b) => b.signal.confidence - a.signal.confidence);
}

export function tapeFingerprint(rows: MarketRow[]): string {
  if (rows.length === 0) return "none";
  return rows
    .slice(0, 6)
    .map((row) => {
      const bucket = Math.round(row.signal.confidence / 5) * 5;
      return `${row.symbol}:${row.signal.side}:${bucket}`;
    })
    .join("|");
}

export function scanLine(snapshot: MarketSnapshot): { title: string; detail: string } {
  const { longs, shorts, waits, aligned, pending, against } = snapshot.breadth;
  return {
    title: `Scan ${snapshot.interval} · ${snapshot.markets.length} pairs`,
    detail: `${longs} long · ${shorts} short · ${waits} wait · ${aligned} aligned · ${pending} htf wait · ${against} vs htf`,
  };
}

export function localAnalystCopy(rows: MarketRow[]): {
  headline: string;
  notes: string;
  stance: "risk-on" | "mixed" | "risk-off";
  focus: string[];
} {
  if (rows.length === 0) {
    return {
      headline: "No cleared calls",
      notes: "Risk has not approved a long or short on this pass. Scanner keeps reading the tape.",
      stance: "mixed",
      focus: [],
    };
  }
  const longs = rows.filter((r) => r.signal.side === "long");
  const shorts = rows.filter((r) => r.signal.side === "short");
  const stance =
    longs.length > 0 && shorts.length === 0
      ? "risk-on"
      : shorts.length > 0 && longs.length === 0
        ? "risk-off"
        : "mixed";
  const focus = rows.slice(0, 4).map((r) => r.base);
  const lead = rows[0]!;
  const headline = `${lead.base} ${lead.signal.side} leads`;
  const notes = rows
    .slice(0, 3)
    .map(
      (r) =>
        `${r.base} ${r.signal.side} at ${r.signal.confidence}${r.alignState === "aligned" ? " aligned" : r.alignState === "pending" ? " htf wait" : ""} — ${r.signal.reasons[0] ?? "setup"}`,
    )
    .join(" ");
  return { headline, notes, stance, focus };
}

export function formatCallMessage(
  row: MarketRow,
  interval: string,
  qty: number,
  riskUsd: number,
  mode: "paper" | "live" = "paper",
): string {
  const { signal } = row;
  const tf = row.higherInterval
    ? `${interval} + ${row.higherInterval}`
    : interval;
  return [
    `MERIDIAN ${signal.side.toUpperCase()} · ${row.base}${signal.quality !== "—" ? ` · ${signal.quality}` : ""}`,
    `${mode.toUpperCase()} · ${tf} · conf ${signal.confidence}${row.alignState === "aligned" ? " · aligned" : row.alignState === "pending" ? " · htf wait" : ""}${signal.setup !== "none" ? ` · ${signal.setup}` : ""}`,
    `Entry ${signal.entry}  Stop ${signal.stop}  Target ${signal.target}`,
    `Size ${qty} ${row.base} · risk $${riskUsd}`,
    signal.reasons.slice(0, 2).join(" · "),
    mode === "live" ? "Live spot order requested." : "Paper fill — not an exchange order.",
  ].join("\n");
}

export function formatCloseMessage(fill: {
  base: string;
  side: string;
  result: string;
  r: number | null;
  pnlUsd: number | null;
  venue: string;
}) {
  const r = fill.r ?? 0;
  const pnl = fill.pnlUsd ?? 0;
  const sign = pnl >= 0 ? "+" : "";
  return [
    `MERIDIAN CLOSE · ${fill.base} ${fill.side}`,
    `${fill.result.toUpperCase()} · ${r > 0 ? "+" : ""}${r}R · ${sign}$${pnl.toFixed(2)}`,
    fill.venue === "live" ? "Live desk." : "Paper desk.",
  ].join("\n");
}
