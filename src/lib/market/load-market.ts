import { evaluateSignal, backtestHits, mergeHitStats, blankSignal, applyTapeContext } from "./engine";
import { stampLastCandle, type LiveQuote } from "./live";
import { startPriceStream, streamQuoteMap, streamQuotes, streamReady } from "./stream";
import type { Candle, MarketRow, MarketSnapshot, Side } from "./types";
import { HIGHER_TF, UNIVERSE, type Interval } from "./universe";
import { sidesAligned, htfAlign, alignBoost } from "./align";

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
  if (interval === "15m") return 60_000;
  if (interval === "1h") return 120_000;
  if (interval === "4h") return 240_000;
  return 400_000;
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
let klineHydrated = false;
const lastCandles = new Map<string, Candle[]>();
const KLINE_LS = "meridian-klines-v1";

function hydrateKlines() {
  if (klineHydrated) return;
  klineHydrated = true;
  if (typeof sessionStorage === "undefined") return;
  try {
    const raw = sessionStorage.getItem(KLINE_LS);
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, KlineEntry>;
    for (const [key, entry] of Object.entries(obj)) {
      if (entry?.candles?.length) {
        klineCache.set(key, entry);
        lastCandles.set(key, entry.candles);
      }
    }
  } catch {
    /* ignore */
  }
}

function persistKlines() {
  if (typeof sessionStorage === "undefined") return;
  const obj: Record<string, KlineEntry> = {};
  for (const [key, entry] of klineCache) obj[key] = entry;
  try {
    sessionStorage.setItem(KLINE_LS, JSON.stringify(obj));
  } catch {
    /* ignore quota */
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  if (Date.now() < restPausedUntil) {
    throw new Error("Market REST paused");
  }
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (res.status === 418 || res.status === 429) {
    restPausedUntil = Date.now() + 90_000;
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

function tickersFromStream(symbols: string[]): Map<string, BinanceTicker> {
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
  return out;
}

async function loadTickersRest(symbols: string[]): Promise<Map<string, BinanceTicker>> {
  const out = new Map<string, BinanceTicker>();
  const chunks: string[][] = [];
  for (let i = 0; i < symbols.length; i += 8) chunks.push(symbols.slice(i, i + 8));
  await mapPool(chunks, 2, async (chunk) => {
    const compact = encodeURIComponent(JSON.stringify(chunk));
    const tickers = await fetchJson<BinanceTicker[]>(
      `${BINANCE}/api/v3/ticker/24hr?symbols=${compact}`,
    );
    for (const t of tickers) out.set(t.symbol, t);
    return 0;
  });
  return out;
}

export async function loadTickers(symbols: string[]): Promise<Map<string, BinanceTicker>> {
  startPriceStream();
  const fromStream = tickersFromStream(symbols);
  if (fromStream.size >= symbols.length) return fromStream;

  const missing = symbols.filter((s) => !fromStream.has(s));
  if (Date.now() < restPausedUntil) {
    const cached = lastGood.get("1h") ?? [...lastGood.values()][0];
    if (cached) {
      for (const m of cached.markets) {
        if (!fromStream.has(m.symbol)) {
          fromStream.set(m.symbol, {
            symbol: m.symbol,
            lastPrice: String(m.price),
            priceChangePercent: String(m.changePct),
            highPrice: String(m.high),
            lowPrice: String(m.low),
            volume: String(m.volume),
            quoteVolume: String(m.quoteVolume),
          });
        }
      }
    }
    return fromStream;
  }

  try {
    const rest = await loadTickersRest(missing.length ? missing : symbols);
    for (const [symbol, ticker] of rest) {
      if (!fromStream.has(symbol)) fromStream.set(symbol, ticker);
    }
    return fromStream;
  } catch {
    const cached = lastGood.get("1h") ?? [...lastGood.values()][0];
    if (cached) {
      for (const m of cached.markets) {
        if (!fromStream.has(m.symbol)) {
          fromStream.set(m.symbol, {
            symbol: m.symbol,
            lastPrice: String(m.price),
            priceChangePercent: String(m.changePct),
            highPrice: String(m.high),
            lowPrice: String(m.low),
            volume: String(m.volume),
            quoteVolume: String(m.quoteVolume),
          });
        }
      }
    }
    if (fromStream.size > 0) return fromStream;
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
  hydrateKlines();
  const key = `${symbol}:${interval}:${limit}`;
  const hit = klineCache.get(key);
  if (hit && Date.now() - hit.at < klineTtl(interval) && hit.candles.length >= 26) {
    return hit.candles;
  }
  if (Date.now() < restPausedUntil) {
    return hit?.candles ?? lastCandles.get(key) ?? [];
  }
  try {
    const candles = await loadKlines(symbol, interval, limit);
    if (candles.length >= 26) {
      klineCache.set(key, { at: Date.now(), candles });
      lastCandles.set(key, candles);
      return candles;
    }
  } catch {
    /* fall through */
  }
  return hit?.candles ?? lastCandles.get(key) ?? [];
}

export async function loadMarket(
  interval: Interval,
  options?: { aiAvailable?: boolean },
): Promise<MarketSnapshot> {
  startPriceStream();
  hydrateKlines();
  try {
    const symbols = UNIVERSE.map((p) => p.symbol);
    const tickerBySymbol = await loadTickers(symbols);
    const higher = HIGHER_TF[interval];

    const klineSets = await mapPool(symbols, 8, async (symbol) => {
      const candles = await loadKlinesCached(symbol, interval);
      return { symbol, candles };
    });

    const bySymbol = new Map(klineSets.map((row) => [row.symbol, row.candles]));

    if (higher) {
      await mapPool(symbols, 6, async (symbol) => {
        if ((bySymbol.get(symbol)?.length ?? 0) < 26) return 0;
        await loadKlinesCached(symbol, higher, 80);
        return 0;
      });
    }

    const chopFloor = CHOP_ATR[interval];
    const markets: MarketRow[] = [];
    for (const pair of UNIVERSE) {
      const ticker = tickerBySymbol.get(pair.symbol);
      const cachedSnap = lastGood.get(interval)?.markets.find((m) => m.symbol === pair.symbol);
      const price = Number(ticker?.lastPrice ?? cachedSnap?.price ?? 0);
      if (!Number.isFinite(price) || price <= 0) continue;
      const candles = bySymbol.get(pair.symbol) ?? [];
      const liveCandles = candles.length >= 26 ? stampLastCandle(candles, price) : candles;
      let higherSide: Side | null = null;
      if (higher && liveCandles.length >= 26) {
        const ht = klineCache.get(`${pair.symbol}:${higher}:80`)?.candles;
        if (ht && ht.length >= 26) higherSide = evaluateSignal(ht).side;
      }
      const signal =
        liveCandles.length >= 26
          ? evaluateSignal(liveCandles, { higherSide })
          : blankSignal(price);
      const alignState = htfAlign(signal.side, higher, higherSide);
      const aligned = sidesAligned(signal.side, higher, higherSide);
      const atrPct = signal.atr != null && price > 0 ? signal.atr / price : null;
      const chop = atrPct != null && atrPct < chopFloor;
      markets.push({
        symbol: pair.symbol,
        base: pair.base,
        name: pair.name,
        price,
        changePct: Number(ticker?.priceChangePercent ?? cachedSnap?.changePct ?? 0),
        high: Number(ticker?.highPrice ?? cachedSnap?.high ?? price),
        low: Number(ticker?.lowPrice ?? cachedSnap?.low ?? price),
        volume: Number(ticker?.volume ?? cachedSnap?.volume ?? 0),
        quoteVolume: Number(ticker?.quoteVolume ?? cachedSnap?.quoteVolume ?? 0),
        candles: liveCandles,
        signal,
        stats: liveCandles.length >= 56 ? backtestHits(liveCandles) : cachedSnap?.stats ?? {
          closed: 0,
          wins: 0,
          losses: 0,
          open: 0,
          winRate: null,
          expectancyR: null,
        },
        higherInterval: higher,
        higherSide,
        alignState,
        aligned,
        chop,
        atrPct,
      });
    }

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
        aligned: markets.filter((m) => m.alignState === "aligned").length,
        pending: markets.filter((m) => m.alignState === "pending").length,
        against: markets.filter((m) => m.alignState === "against").length,
      },
    };
    if (markets.length === 0 && streamReady()) {
      throw new Error("No candles yet");
    }
    if (markets.length > 0) lastGood.set(interval, data);
    persistKlines();
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
    const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));
    const prior = lastGood.get(interval)?.markets ?? [];
    const priorMap = new Map(prior.map((m) => [m.symbol, m]));
    const markets: MarketRow[] = [];
    for (const pair of UNIVERSE) {
      const q = quoteMap.get(pair.symbol);
      const old = priorMap.get(pair.symbol);
      if (!q && !old) continue;
      markets.push({
        symbol: pair.symbol,
        base: pair.base,
        name: pair.name,
        price: q?.price ?? old!.price,
        changePct: q?.changePct ?? old!.changePct,
        high: q?.high ?? old!.high,
        low: q?.low ?? old!.low,
        volume: q?.volume ?? old!.volume,
        quoteVolume: q?.quoteVolume ?? old!.quoteVolume,
        candles: old?.candles ?? [],
        signal: old?.signal ?? blankSignal(q?.price ?? old!.price),
        stats: old?.stats ?? { closed: 0, wins: 0, losses: 0, open: 0, winRate: null, expectancyR: null },
        higherInterval: HIGHER_TF[interval],
        higherSide: old?.higherSide ?? null,
        alignState: old?.alignState ?? "none",
        aligned: old?.aligned ?? false,
        chop: old?.chop ?? false,
        atrPct: old?.atrPct ?? null,
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
        pending: 0,
        against: 0,
      },
    };
  }
}
