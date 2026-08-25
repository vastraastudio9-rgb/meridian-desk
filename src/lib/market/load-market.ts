import { evaluateSignal, backtestHits, mergeHitStats } from "./engine";
import { stampLastCandle, type LiveQuote } from "./live";
import { startPriceStream, streamQuoteMap, streamQuotes, streamReady } from "./stream";
import type { Candle, MarketRow, MarketSnapshot, Side } from "./types";
import { HIGHER_TF, PAIR_BY_SYMBOL, UNIVERSE, type Interval } from "./universe";

const BINANCE = "https://data-api.binance.vision";
const CHOP_ATR: Record<Interval, number> = {
  "15m": 0.0028,
  "1h": 0.0042,
  "4h": 0.008,
  "1d": 0.016,
};

type KlineEntry = { at: number; candles: Candle[] };
const klineCache = new Map<string, KlineEntry>();
const lastGood = new Map<Interval, MarketSnapshot>();

function klineTtl(interval: Interval) {
  if (interval === "15m") return 45_000;
  if (interval === "1h") return 90_000;
  if (interval === "4h") return 180_000;
  return 300_000;
}

type BinanceTicker = {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
};

type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

let restPausedUntil = 0;

async function fetchJson<T>(url: string): Promise<T> {
  if (Date.now() < restPausedUntil) {
    throw new Error("Market REST paused");
  }
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (res.status === 418 || res.status === 429) {
    restPausedUntil = Date.now() + 8 * 60_000;
    throw new Error(`Market data error ${res.status}`);
  }
  if (!res.ok) {
    throw new Error(`Market data error ${res.status}`);
  }
  return (await res.json()) as T;
}

function parseKlines(raw: BinanceKline[]): Candle[] {
  return raw.map((k) => ({
    t: k[0],
    o: Number(k[1]),
    h: Number(k[2]),
    l: Number(k[3]),
    c: Number(k[4]),
    v: Number(k[5]),
  }));
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      out[idx] = await fn(items[idx]!);
    }
  }
  const n = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

function tickersFromStream(symbols: string[]): Map<string, BinanceTicker> | null {
  if (!streamReady()) return null;
  const map = streamQuoteMap();
  const out = new Map<string, BinanceTicker>();
  for (const symbol of symbols) {
    const q = map.get(symbol);
    if (!q) continue;
    out.set(symbol, {
      symbol,
      lastPrice: String(q.price),
      priceChangePercent: String(q.changePct),
      highPrice: String(q.high),
      lowPrice: String(q.low),
      volume: String(q.volume),
      quoteVolume: String(q.quoteVolume),
    });
  }
  return out.size >= Math.min(8, symbols.length) ? out : null;
}

export async function loadTickers(symbols: string[]): Promise<Map<string, BinanceTicker>> {
  const fromStream = tickersFromStream(symbols);
  if (fromStream) return fromStream;
  if (Date.now() < restPausedUntil) {
    const cached = lastGood.get("1h") ?? [...lastGood.values()][0];
    if (cached) {
      return new Map(
        cached.markets.map((m) => [
          m.symbol,
          {
            symbol: m.symbol,
            lastPrice: String(m.price),
            priceChangePercent: String(m.changePct),
            highPrice: String(m.high),
            lowPrice: String(m.low),
            volume: String(m.volume),
            quoteVolume: String(m.quoteVolume),
          },
        ]),
      );
    }
    throw new Error("Ticker feed paused");
  }
  const compact = encodeURIComponent(JSON.stringify(symbols));
  try {
    const tickers = await fetchJson<BinanceTicker[]>(
      `${BINANCE}/api/v3/ticker/24hr?symbols=${compact}`,
    );
    return new Map(tickers.map((t) => [t.symbol, t]));
  } catch {
    const cached = lastGood.get("1h");
    if (cached) {
      return new Map(
        cached.markets.map((m) => [
          m.symbol,
          {
            symbol: m.symbol,
            lastPrice: String(m.price),
            priceChangePercent: String(m.changePct),
            highPrice: String(m.high),
            lowPrice: String(m.low),
            volume: String(m.volume),
            quoteVolume: String(m.quoteVolume),
          },
        ]),
      );
    }
    throw new Error("Ticker feed unreachable");
  }
}

export function quotesFromTickers(tickers: Map<string, BinanceTicker>): LiveQuote[] {
  const quotes: LiveQuote[] = [];
  for (const [symbol, ticker] of tickers) {
    const price = Number(ticker.lastPrice);
    if (!Number.isFinite(price) || price <= 0) continue;
    quotes.push({
      symbol,
      price,
      changePct: Number(ticker.priceChangePercent),
      high: Number(ticker.highPrice),
      low: Number(ticker.lowPrice),
      volume: Number(ticker.volume),
      quoteVolume: Number(ticker.quoteVolume),
    });
  }
  return quotes;
}

export async function loadQuotes(): Promise<LiveQuote[]> {
  startPriceStream();
  const live = streamQuotes();
  if (live.length >= 8) return live;
  const symbols = UNIVERSE.map((p) => p.symbol);
  try {
    const tickers = await loadTickers(symbols);
    return quotesFromTickers(tickers);
  } catch {
    return live;
  }
}

async function loadKlines(symbol: string, interval: Interval, limit = 100): Promise<Candle[]> {
  const raw = await fetchJson<BinanceKline[]>(
    `${BINANCE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
  );
  return parseKlines(raw);
}

async function loadKlinesCached(
  symbol: string,
  interval: Interval,
  limit = 100,
): Promise<Candle[]> {
  const key = `${symbol}:${interval}:${limit}`;
  const hit = klineCache.get(key);
  if (hit && Date.now() - hit.at < klineTtl(interval)) return hit.candles;
  if (Date.now() < restPausedUntil) return hit?.candles ?? [];
  const candles = await loadKlines(symbol, interval, limit);
  klineCache.set(key, { at: Date.now(), candles });
  return candles;
}

export async function loadMarket(
  interval: Interval,
  options?: { aiAvailable?: boolean },
): Promise<MarketSnapshot> {
  startPriceStream();
  try {
    const symbols = UNIVERSE.map((p) => p.symbol);
    const tickerBySymbol = await loadTickers(symbols);
    const higher = HIGHER_TF[interval];

    const klineSets = await mapPool(symbols, 6, async (symbol) => {
      try {
        const candles = await loadKlinesCached(symbol, interval);
        return { symbol, candles };
      } catch {
        return { symbol, candles: [] as Candle[] };
      }
    });

    const draft: Array<{ symbol: string; candles: Candle[]; side: Side }> = [];
    for (const { symbol, candles } of klineSets) {
      if (candles.length < 30) continue;
      draft.push({ symbol, candles, side: evaluateSignal(candles).side });
    }

    const needHigher = higher
      ? draft.filter((d) => d.side !== "wait").map((d) => d.symbol)
      : [];
    const higherSideBySymbol = new Map<string, Side>();
    if (higher && needHigher.length > 0) {
      const higherSets = await mapPool(needHigher, 4, async (symbol) => {
        try {
          const candles = await loadKlinesCached(symbol, higher, 80);
          return { symbol, side: evaluateSignal(candles).side };
        } catch {
          return { symbol, side: "wait" as Side };
        }
      });
      for (const row of higherSets) higherSideBySymbol.set(row.symbol, row.side);
    }

    const chopFloor = CHOP_ATR[interval];
    const markets: MarketRow[] = [];
    for (const { symbol, candles } of draft) {
      const pair = PAIR_BY_SYMBOL.get(symbol);
      const ticker = tickerBySymbol.get(symbol);
      if (!pair || !ticker) continue;
      const price = Number(ticker.lastPrice);
      if (!Number.isFinite(price) || price <= 0) continue;
      const liveCandles = stampLastCandle(candles, price);
      const signal = evaluateSignal(liveCandles);
      const atrPct =
        signal.atr != null && price > 0 ? signal.atr / price : null;
      const higherSide = higher ? (higherSideBySymbol.get(symbol) ?? null) : null;
      const aligned =
        signal.side !== "wait" &&
        (!higher ||
          higherSide === signal.side ||
          higherSide === "wait" ||
          higherSide == null);
      const chop = atrPct != null && atrPct < chopFloor;
      markets.push({
        symbol,
        base: pair.base,
        name: pair.name,
        price,
        changePct: Number(ticker.priceChangePercent),
        high: Number(ticker.highPrice),
        low: Number(ticker.lowPrice),
        volume: Number(ticker.volume),
        quoteVolume: Number(ticker.quoteVolume),
        candles: liveCandles,
        signal,
        stats: backtestHits(liveCandles),
        higherInterval: higher,
        higherSide,
        aligned,
        chop,
        atrPct,
      });
    }

    markets.sort((a, b) => {
      const rank = (s: MarketRow) =>
        (s.aligned ? 400 : 0) + (s.signal.side === "wait" ? 0 : 1000) + s.signal.confidence;
      return rank(b) - rank(a);
    });

    const longs = markets.filter((m) => m.signal.side === "long").length;
    const shorts = markets.filter((m) => m.signal.side === "short").length;
    const data: MarketSnapshot = {
      generatedAt: Date.now(),
      quotedAt: Date.now(),
      interval,
      markets,
      aiAvailable: Boolean(options?.aiAvailable),
      source: "binance",
      deskStats: mergeHitStats(markets.map((m) => m.stats)),
      breadth: {
        longs,
        shorts,
        waits: markets.length - longs - shorts,
        aligned: markets.filter((m) => m.aligned).length,
      },
    };
    if (markets.length === 0 && streamReady()) {
      throw new Error("No candles yet");
    }
    if (markets.length > 0) lastGood.set(interval, data);
    return data;
  } catch {
    const cached = lastGood.get(interval) ?? [...lastGood.values()][0];
    if (cached) {
      return {
        ...cached,
        interval,
        quotedAt: Date.now(),
        aiAvailable: Boolean(options?.aiAvailable),
      };
    }
    startPriceStream();
    const quotes = streamQuotes();
    const markets: MarketRow[] = [];
    for (const q of quotes) {
      const pair = PAIR_BY_SYMBOL.get(q.symbol);
      if (!pair) continue;
      markets.push({
        symbol: q.symbol,
        base: pair.base,
        name: pair.name,
        price: q.price,
        changePct: q.changePct,
        high: q.high,
        low: q.low,
        volume: q.volume,
        quoteVolume: q.quoteVolume,
        candles: [],
        signal: {
          side: "wait",
          confidence: 0,
          score: 0,
          reasons: ["Waiting on candles"],
          entry: q.price,
          stop: q.price,
          target: q.price,
          rsi: null,
          macdHist: null,
          emaBias: "flat",
          volumeRatio: null,
          atr: null,
        },
        stats: { closed: 0, wins: 0, losses: 0, open: 0, winRate: null, expectancyR: null },
        higherInterval: HIGHER_TF[interval],
        higherSide: null,
        aligned: false,
        chop: false,
        atrPct: null,
      });
    }
    return {
      generatedAt: Date.now(),
      quotedAt: Date.now(),
      interval,
      markets,
      aiAvailable: Boolean(options?.aiAvailable),
      source: "binance",
      deskStats: { closed: 0, wins: 0, losses: 0, open: 0, winRate: null, expectancyR: null },
      breadth: {
        longs: 0,
        shorts: 0,
        waits: markets.length,
        aligned: 0,
      },
    };
  }
}
