import { UNIVERSE } from "./universe";
import type { LiveQuote } from "./live";

const WANTED = new Set(UNIVERSE.map((p) => p.symbol));

type Bag = {
  quotes: Map<string, LiveQuote>;
  ws: WebSocket | null;
  started: boolean;
  timer: ReturnType<typeof setTimeout> | null;
};

function bag(): Bag {
  const g = globalThis as typeof globalThis & { __meridianTapeStream3?: Bag };
  if (!g.__meridianTapeStream3) {
    g.__meridianTapeStream3 = { quotes: new Map(), ws: null, started: false, timer: null };
  }
  return g.__meridianTapeStream3;
}

function applyMini(raw: {
  s?: string;
  c?: string;
  o?: string;
  h?: string;
  l?: string;
  v?: string;
  q?: string;
}) {
  const symbol = String(raw.s ?? "");
  if (!WANTED.has(symbol)) return;
  const price = Number(raw.c);
  const open = Number(raw.o);
  if (!Number.isFinite(price) || price <= 0) return;
  const changePct = open > 0 ? ((price - open) / open) * 100 : 0;
  bag().quotes.set(symbol, {
    symbol,
    price,
    changePct,
    high: Number(raw.h),
    low: Number(raw.l),
    volume: Number(raw.v),
    quoteVolume: Number(raw.q),
  });
}

function connect() {
  const b = bag();
  const url = "wss://data-stream.binance.vision/ws/!miniTicker@arr";
  try {
    const ws = new WebSocket(url);
    b.ws = ws;
    ws.addEventListener("message", (ev) => {
      try {
        const arr = JSON.parse(String(ev.data)) as unknown;
        if (!Array.isArray(arr)) return;
        for (const item of arr) applyMini(item as Parameters<typeof applyMini>[0]);
      } catch {
        /* ignore */
      }
    });
    ws.addEventListener("close", () => {
      b.ws = null;
      if (!b.started) return;
      b.timer = setTimeout(connect, 4_000);
    });
    ws.addEventListener("error", () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    });
  } catch {
    b.timer = setTimeout(connect, 6_000);
  }
}

export function startPriceStream() {
  const b = bag();
  if (b.started) return;
  b.started = true;
  connect();
}

export function streamQuotes(): LiveQuote[] {
  return [...bag().quotes.values()];
}

export function streamQuoteMap(): Map<string, LiveQuote> {
  return bag().quotes;
}

export function streamReady(): boolean {
  return bag().quotes.size >= 8;
}
