import { applyTapeContext, evaluateSignal } from "./engine";
import { htfAlign, sidesAligned, alignBoost } from "./align";
import type { Candle, MarketRow, MarketSnapshot } from "./types";
import { HIGHER_TF, type Interval } from "./universe";

const CHOP_ATR: Record<Interval, number> = {
  "15m": 0.0028,
  "1h": 0.0042,
  "4h": 0.008,
  "1d": 0.016,
};

export type LiveQuote = {
  symbol: string;
  price: number;
  changePct: number;
  high: number;
  low: number;
  volume: number;
  quoteVolume: number;
};

export function stampLastCandle(candles: Candle[], price: number): Candle[] {
  if (candles.length === 0 || !Number.isFinite(price) || price <= 0) return candles;
  const last = candles[candles.length - 1]!;
  return [
    ...candles.slice(0, -1),
    {
      ...last,
      c: price,
      h: Math.max(last.h, price),
      l: Math.min(last.l, price),
    },
  ];
}

export function applyLiveQuotes(
  snapshot: MarketSnapshot,
  quotes: LiveQuote[],
): MarketSnapshot {
  if (quotes.length === 0) return snapshot;
  const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));
  const higher = HIGHER_TF[snapshot.interval];
  const chopFloor = CHOP_ATR[snapshot.interval];

  const markets: MarketRow[] = snapshot.markets.map((row) => {
    const quote = bySymbol.get(row.symbol);
    if (!quote) return row;
    const candles = stampLastCandle(row.candles, quote.price);
    const signal = evaluateSignal(candles, { higherSide: row.higherSide });
    const atrPct =
      signal.atr != null && quote.price > 0 ? signal.atr / quote.price : null;
    const alignState = htfAlign(signal.side, higher, row.higherSide);
    const aligned = sidesAligned(signal.side, higher, row.higherSide);
    return {
      ...row,
      price: quote.price,
      changePct: quote.changePct,
      high: quote.high,
      low: quote.low,
      volume: quote.volume,
      quoteVolume: quote.quoteVolume,
      candles,
      signal,
      atrPct,
      alignState,
      aligned,
      chop: atrPct != null && atrPct < chopFloor,
    };
  });

  applyTapeContext(markets);
  for (const row of markets) {
    row.alignState = htfAlign(row.signal.side, higher, row.higherSide);
    row.aligned = sidesAligned(row.signal.side, higher, row.higherSide);
  }

  markets.sort((a, b) => {
    const rank = (s: MarketRow) =>
      alignBoost(s.alignState) +
      (s.signal.side === "wait" ? 0 : 1000) +
      (s.signal.quality === "A" ? 90 : s.signal.quality === "B" ? 40 : 0) +
      s.signal.confidence;
    return rank(b) - rank(a);
  });

  const longs = markets.filter((m) => m.signal.side === "long").length;
  const shorts = markets.filter((m) => m.signal.side === "short").length;

  return {
    ...snapshot,
    quotedAt: Date.now(),
    markets,
    breadth: {
      longs,
      shorts,
      waits: markets.length - longs - shorts,
      aligned: markets.filter((m) => m.alignState === "aligned").length,
      pending: markets.filter((m) => m.alignState === "pending").length,
      against: markets.filter((m) => m.alignState === "against").length,
    },
  };
}
