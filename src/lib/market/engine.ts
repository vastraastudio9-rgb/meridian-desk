import type { Candle, HitStats, MarketRow, Signal, Side } from "./types";

function lastFinite(arr: Array<number | null>, offset = 0): number | null {
  let seen = 0;
  for (let i = arr.length - 1; i >= 0; i--) {
    const v = arr[i];
    if (v != null && Number.isFinite(v)) {
      if (seen === offset) return v;
      seen += 1;
    }
  }
  return null;
}

export function sma(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= period) sum -= values[i - period]!;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i]!;
  let prev = sum / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i]! * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function rsi(closes: number[], period = 14): Array<number | null> {
  const out: Array<number | null> = Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i]! - closes[i - 1]!;
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i]! - closes[i - 1]!;
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function macd(closes: number[]) {
  const fast = ema(closes, 12);
  const slow = ema(closes, 26);
  const line: Array<number | null> = closes.map((_, i) => {
    const a = fast[i];
    const b = slow[i];
    if (a == null || b == null) return null;
    return a - b;
  });
  const lineVals: number[] = [];
  const lineIdx: number[] = [];
  line.forEach((v, i) => {
    if (v != null) {
      lineVals.push(v);
      lineIdx.push(i);
    }
  });
  const signalSparse = ema(lineVals, 9);
  const signal: Array<number | null> = Array(closes.length).fill(null);
  const hist: Array<number | null> = Array(closes.length).fill(null);
  signalSparse.forEach((v, j) => {
    if (v == null) return;
    const i = lineIdx[j]!;
    signal[i] = v;
    hist[i] = line[i]! - v;
  });
  return { line, signal, hist };
}

export function atr(candles: Candle[], period = 14): Array<number | null> {
  const out: Array<number | null> = Array(candles.length).fill(null);
  if (candles.length <= period) return out;
  const tr: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]!;
    if (i === 0) {
      tr.push(c.h - c.l);
      continue;
    }
    const prev = candles[i - 1]!.c;
    tr.push(Math.max(c.h - c.l, Math.abs(c.h - prev), Math.abs(c.l - prev)));
  }
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += tr[i]!;
  let prevAtr = sum / period;
  out[period] = prevAtr;
  for (let i = period + 1; i < tr.length; i++) {
    prevAtr = (prevAtr * (period - 1) + tr[i]!) / period;
    out[i] = prevAtr;
  }
  return out;
}

function roundPx(px: number): number {
  const abs = Math.abs(px);
  if (abs >= 1000) return Math.round(px * 10) / 10;
  if (abs >= 100) return Math.round(px * 100) / 100;
  if (abs >= 1) return Math.round(px * 1000) / 1000;
  if (abs >= 0.01) return Math.round(px * 1e5) / 1e5;
  return px;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function recentCross(
  a: Array<number | null>,
  b: Array<number | null>,
  lookback = 3,
): "bull" | "bear" | null {
  const end = a.length - 1;
  for (let i = end; i > end - lookback && i > 0; i--) {
    const a0 = a[i - 1];
    const b0 = b[i - 1];
    const a1 = a[i];
    const b1 = b[i];
    if (a0 == null || b0 == null || a1 == null || b1 == null) continue;
    if (a0 <= b0 && a1 > b1) return "bull";
    if (a0 >= b0 && a1 < b1) return "bear";
  }
  return null;
}

function lastAdx(candles: Candle[], period = 14): number | null {
  if (candles.length < period * 2 + 2) return null;
  let plusDM = 0;
  let minusDM = 0;
  let trSum = 0;
  for (let i = 1; i <= period; i++) {
    const cur = candles[i]!;
    const prev = candles[i - 1]!;
    const up = cur.h - prev.h;
    const down = prev.l - cur.l;
    plusDM += up > down && up > 0 ? up : 0;
    minusDM += down > up && down > 0 ? down : 0;
    trSum += Math.max(cur.h - cur.l, Math.abs(cur.h - prev.c), Math.abs(cur.l - prev.c));
  }
  let smPlus = plusDM;
  let smMinus = minusDM;
  let smTR = trSum;
  const dxs: number[] = [];
  for (let i = period + 1; i < candles.length; i++) {
    const cur = candles[i]!;
    const prev = candles[i - 1]!;
    const up = cur.h - prev.h;
    const down = prev.l - cur.l;
    const p = up > down && up > 0 ? up : 0;
    const m = down > up && down > 0 ? down : 0;
    const tr = Math.max(cur.h - cur.l, Math.abs(cur.h - prev.c), Math.abs(cur.l - prev.c));
    smPlus = smPlus - smPlus / period + p;
    smMinus = smMinus - smMinus / period + m;
    smTR = smTR - smTR / period + tr;
    const pdi = smTR === 0 ? 0 : (100 * smPlus) / smTR;
    const mdi = smTR === 0 ? 0 : (100 * smMinus) / smTR;
    const dx = pdi + mdi === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / (pdi + mdi);
    dxs.push(dx);
  }
  if (dxs.length < period) return null;
  let adx = dxs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dxs.length; i++) {
    adx = (adx * (period - 1) + dxs[i]!) / period;
  }
  return adx;
}

function swingPivots(candles: Candle[], wing = 2) {
  const highs: { i: number; px: number }[] = [];
  const lows: { i: number; px: number }[] = [];
  const end = Math.max(wing + 1, candles.length - 1);
  for (let i = wing; i < end - wing; i++) {
    let isH = true;
    let isL = true;
    for (let k = 1; k <= wing; k++) {
      if (candles[i]!.h <= candles[i - k]!.h || candles[i]!.h <= candles[i + k]!.h) isH = false;
      if (candles[i]!.l >= candles[i - k]!.l || candles[i]!.l >= candles[i + k]!.l) isL = false;
    }
    if (isH) highs.push({ i, px: candles[i]!.h });
    if (isL) lows.push({ i, px: candles[i]!.l });
  }
  return { highs, lows };
}

function rsiDivergence(
  candles: Candle[],
  rsiArr: Array<number | null>,
): "bull" | "bear" | null {
  const { highs, lows } = swingPivots(candles, 2);
  if (lows.length >= 2) {
    const a = lows[lows.length - 2]!;
    const b = lows[lows.length - 1]!;
    const ra = rsiArr[a.i];
    const rb = rsiArr[b.i];
    if (ra != null && rb != null && b.px < a.px && rb > ra + 3) return "bull";
  }
  if (highs.length >= 2) {
    const a = highs[highs.length - 2]!;
    const b = highs[highs.length - 1]!;
    const ra = rsiArr[a.i];
    const rb = rsiArr[b.i];
    if (ra != null && rb != null && b.px > a.px && rb < ra - 3) return "bear";
  }
  return null;
}

function structureBias(candles: Candle[]): "up" | "down" | "range" {
  const { highs, lows } = swingPivots(candles, 2);
  if (highs.length < 2 || lows.length < 2) return "range";
  const h1 = highs[highs.length - 2]!.px;
  const h2 = highs[highs.length - 1]!.px;
  const l1 = lows[lows.length - 2]!.px;
  const l2 = lows[lows.length - 1]!.px;
  if (h2 > h1 && l2 > l1) return "up";
  if (h2 < h1 && l2 < l1) return "down";
  return "range";
}

export function blankSignal(price: number, reason = "Waiting on candles"): Signal {
  return {
    side: "wait",
    confidence: 12,
    score: 0,
    reasons: [reason],
    entry: price,
    stop: price,
    target: price,
    rsi: null,
    macdHist: null,
    emaBias: "flat",
    volumeRatio: null,
    atr: null,
    quality: "—",
    setup: "none",
    adx: null,
  };
}

function lastSwing(candles: Candle[], kind: "high" | "low"): number | null {
  const { highs, lows } = swingPivots(candles, 2);
  if (kind === "high") return highs.length ? highs[highs.length - 1]!.px : null;
  return lows.length ? lows[lows.length - 1]!.px : null;
}

function barConfirms(bar: Candle, side: "long" | "short"): boolean {
  const body = Math.abs(bar.c - bar.o);
  const lower = Math.min(bar.o, bar.c) - bar.l;
  const upper = bar.h - Math.max(bar.o, bar.c);
  if (side === "long") {
    return bar.c >= bar.o || (lower > Math.max(body, 1e-12) * 1.2 && bar.c >= bar.o * 0.998);
  }
  return bar.c <= bar.o || (upper > Math.max(body, 1e-12) * 1.2 && bar.c <= bar.o * 1.002);
}

type EntryGate = { ok: boolean; why: string };

function longEntryGate(opts: {
  setup: Signal["setup"];
  higherSide: Side | null | undefined;
  rsi: number | null;
  diverge: "bull" | "bear" | null;
  confirm: boolean;
  volumeRatio: number | null;
  atrFrac: number;
}): EntryGate {
  if (opts.higherSide === "short") return { ok: false, why: "No long against HTF short" };
  if (opts.rsi != null && opts.rsi > 70 && opts.diverge !== "bull") {
    return { ok: false, why: "RSI too high to long" };
  }
  if (opts.setup === "pullback") {
    if (!opts.confirm) return { ok: false, why: "Pullback needs a bullish close" };
    return { ok: true, why: "" };
  }
  if (opts.setup === "breakout") {
    if (!opts.confirm) return { ok: false, why: "Breakout not closed above" };
    if (opts.volumeRatio != null && opts.volumeRatio < 1.12) {
      return { ok: false, why: "Breakout needs volume" };
    }
    if (opts.atrFrac > 2.3) return { ok: false, why: "Breakout already extended" };
    return { ok: true, why: "" };
  }
  if (opts.setup === "diverge") return { ok: true, why: "" };
  if (opts.atrFrac >= 1.5) return { ok: false, why: "Wait for pullback to EMA 21" };
  return { ok: false, why: "No entry trigger yet" };
}

function shortEntryGate(opts: {
  setup: Signal["setup"];
  higherSide: Side | null | undefined;
  rsi: number | null;
  diverge: "bull" | "bear" | null;
  confirm: boolean;
  volumeRatio: number | null;
  atrFrac: number;
}): EntryGate {
  if (opts.higherSide === "long") return { ok: false, why: "No short against HTF long" };
  if (opts.rsi != null && opts.rsi < 30 && opts.diverge !== "bear") {
    return { ok: false, why: "RSI too low to short" };
  }
  if (opts.setup === "pullback") {
    if (!opts.confirm) return { ok: false, why: "Rally needs a bearish close" };
    return { ok: true, why: "" };
  }
  if (opts.setup === "breakout") {
    if (!opts.confirm) return { ok: false, why: "Breakdown not closed below" };
    if (opts.volumeRatio != null && opts.volumeRatio < 1.12) {
      return { ok: false, why: "Breakdown needs volume" };
    }
    if (opts.atrFrac > 2.3) return { ok: false, why: "Breakdown already extended" };
    return { ok: true, why: "" };
  }
  if (opts.setup === "diverge") return { ok: true, why: "" };
  if (opts.atrFrac >= 1.5) return { ok: false, why: "Wait for rally into EMA 21" };
  return { ok: false, why: "No entry trigger yet" };
}

export type SignalCtx = {
  higherSide?: Side | null;
};

export function evaluateSignal(candles: Candle[], ctx: SignalCtx = {}): Signal {
  if (candles.length < 26) return blankSignal(candles[candles.length - 1]?.c ?? 0);

  const closes = candles.map((c) => c.c);
  const closed = candles.length > 1 ? candles.slice(0, -1) : candles;
  const volumes = closed.map((c) => c.v);
  const last = candles[candles.length - 1]!;
  const prevBar = closed[closed.length - 1] ?? last;
  const price = last.c;

  const rsiArr = rsi(closes, 14);
  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const sma50 = sma(closes, 50);
  const macdRes = macd(closes);
  const atrArr = atr(candles, 14);
  const volSma = sma(volumes, 20);
  const adxNow = lastAdx(closed, 14);

  const rsiNow = lastFinite(rsiArr);
  const ema9Now = lastFinite(ema9);
  const ema21Now = lastFinite(ema21);
  const sma50Now = lastFinite(sma50);
  const histNow = lastFinite(macdRes.hist);
  const histPrev = lastFinite(macdRes.hist, 1);
  const atrNow = lastFinite(atrArr);
  const volNow = volumes[volumes.length - 1] ?? 0;
  const volAvg = lastFinite(volSma);
  const volumeRatio = volAvg && volAvg > 0 ? volNow / volAvg : null;

  let score = 0;
  const reasons: string[] = [];
  let bulls = 0;
  let bears = 0;

  if (rsiNow != null) {
    if (rsiNow < 30) {
      score += 22;
      bulls += 1;
      reasons.push(`RSI ${rsiNow.toFixed(0)} — oversold`);
    } else if (rsiNow < 40) {
      score += 10;
      bulls += 1;
      reasons.push(`RSI ${rsiNow.toFixed(0)} — weak`);
    } else if (rsiNow > 70) {
      score -= 22;
      bears += 1;
      reasons.push(`RSI ${rsiNow.toFixed(0)} — overbought`);
    } else if (rsiNow > 60) {
      score -= 10;
      bears += 1;
      reasons.push(`RSI ${rsiNow.toFixed(0)} — stretched`);
    }
  }

  const diverge = rsiDivergence(closed, rsiArr);
  if (diverge === "bull") {
    score += 18;
    bulls += 2;
    reasons.push("Bullish RSI divergence");
  } else if (diverge === "bear") {
    score -= 18;
    bears += 2;
    reasons.push("Bearish RSI divergence");
  }

  const emaCross = recentCross(ema9, ema21, 4);
  const stackBull = ema9Now != null && ema21Now != null && ema9Now > ema21Now;
  const stackBear = ema9Now != null && ema21Now != null && ema9Now < ema21Now;
  if (stackBull) {
    score += 16;
    bulls += 1;
    if (emaCross === "bull") {
      score += 10;
      bulls += 1;
      reasons.push("EMA 9 crossed above 21");
    } else {
      reasons.push("EMA stack is bullish");
    }
  } else if (stackBear) {
    score -= 16;
    bears += 1;
    if (emaCross === "bear") {
      score -= 10;
      bears += 1;
      reasons.push("EMA 9 crossed below 21");
    } else {
      reasons.push("EMA stack is bearish");
    }
  }

  if (histNow != null) {
    if (histNow > 0) {
      score += 12;
      bulls += 1;
      if (histPrev != null && histPrev <= 0) {
        score += 8;
        bulls += 1;
        reasons.push("MACD histogram flipped positive");
      } else if (histPrev != null && histNow > histPrev) {
        score += 4;
        reasons.push("MACD momentum expanding");
      }
    } else {
      score -= 12;
      bears += 1;
      if (histPrev != null && histPrev >= 0) {
        score -= 8;
        bears += 1;
        reasons.push("MACD histogram flipped negative");
      } else if (histPrev != null && histNow < histPrev) {
        score -= 4;
        reasons.push("MACD momentum fading");
      }
    }
  }

  if (sma50Now != null && price > 0) {
    if (price > sma50Now) {
      score += 10;
      bulls += 1;
      reasons.push("Price holding above 50 SMA");
    } else {
      score -= 10;
      bears += 1;
      reasons.push("Price trading below 50 SMA");
    }
  }

  const struct = structureBias(closed);
  if (struct === "up") {
    score += 8;
    bulls += 1;
    reasons.push("Structure HH / HL");
  } else if (struct === "down") {
    score -= 8;
    bears += 1;
    reasons.push("Structure LH / LL");
  }

  if (adxNow != null) {
    if (adxNow < 16) {
      score *= 0.62;
      reasons.push(`ADX ${adxNow.toFixed(0)} — ranging`);
    } else if (adxNow >= 25) {
      if (score > 0) score += 8;
      if (score < 0) score -= 8;
      reasons.push(`ADX ${adxNow.toFixed(0)} — trending`);
    }
  }

  let setup: Signal["setup"] = "none";
  let atrFrac = 0;
  if (ema21Now != null && price > 0 && atrNow && atrNow > 0) {
    const dist = (price - ema21Now) / Math.max(price, 1e-9);
    atrFrac = Math.abs(price - ema21Now) / atrNow;
    const near = Math.abs(dist) <= 0.012 || atrFrac <= 0.9;
    if (stackBull && price >= ema21Now && near) {
      score += 14;
      bulls += 1;
      setup = "pullback";
      reasons.push("Pullback to EMA 21");
    } else if (stackBear && price <= ema21Now && near) {
      score -= 14;
      bears += 1;
      setup = "pullback";
      reasons.push("Rally into EMA 21");
    } else if (atrFrac >= 1.6) {
      score *= 0.72;
      reasons.push("Extended from EMA 21");
    }
  }

  if (closed.length >= 21) {
    const window = closed.slice(-21, -1);
    let hi = -Infinity;
    let lo = Infinity;
    for (const bar of window) {
      if (bar.h > hi) hi = bar.h;
      if (bar.l < lo) lo = bar.l;
    }
    if (prevBar.c > hi) {
      score += 12;
      bulls += 1;
      if (setup === "none") setup = "breakout";
      reasons.push("20-bar high break");
    } else if (prevBar.c < lo) {
      score -= 12;
      bears += 1;
      if (setup === "none") setup = "breakout";
      reasons.push("20-bar low break");
    }
  }

  if (prevBar.c > prevBar.o) {
    score += 5;
    bulls += 1;
  } else if (prevBar.c < prevBar.o) {
    score -= 5;
    bears += 1;
  }

  if (volumeRatio != null) {
    if (volumeRatio >= 1.8) {
      score += score >= 0 ? 8 : -8;
      reasons.push(`Volume ${volumeRatio.toFixed(1)}× average`);
    } else if (volumeRatio <= 0.55) {
      score *= 0.88;
    }
  }

  if (ctx.higherSide === "long") {
    score += 12;
    bulls += 1;
    reasons.push("Higher TF is long");
  } else if (ctx.higherSide === "short") {
    score -= 12;
    bears += 1;
    reasons.push("Higher TF is short");
  }

  if (closes.length > 10) {
    const prev = closes[closes.length - 11]!;
    if (prev > 0) {
      const mom = ((price - prev) / prev) * 100;
      score += clamp(mom * 1.1, -10, 10);
      if (Math.abs(mom) >= 3) {
        reasons.push(`10-bar momentum ${mom > 0 ? "+" : ""}${mom.toFixed(1)}%`);
      }
    }
  }

  score = clamp(score, -100, 100);

  if (setup === "none" && diverge) setup = "diverge";

  const trendAgree =
    ema9Now != null &&
    ema21Now != null &&
    histNow != null &&
    ((score > 0 && ema9Now > ema21Now && histNow > 0) ||
      (score < 0 && ema9Now < ema21Now && histNow < 0));
  const trendReady = adxNow == null || adxNow >= 16 || setup === "diverge";

  const leanLong =
    trendReady &&
    (score >= 30 || (score >= 20 && trendAgree) || (diverge === "bull" && score >= 14));
  const leanShort =
    trendReady &&
    (score <= -30 || (score <= -20 && trendAgree) || (diverge === "bear" && score <= -14));

  const longGate = longEntryGate({
    setup,
    higherSide: ctx.higherSide,
    rsi: rsiNow,
    diverge,
    confirm: barConfirms(prevBar, "long"),
    volumeRatio,
    atrFrac,
  });
  const shortGate = shortEntryGate({
    setup,
    higherSide: ctx.higherSide,
    rsi: rsiNow,
    diverge,
    confirm: barConfirms(prevBar, "short"),
    volumeRatio,
    atrFrac,
  });

  let side: Side = "wait";
  if (leanLong && longGate.ok) side = "long";
  else if (leanShort && shortGate.ok) side = "short";
  else if (leanLong && !longGate.ok) reasons.push(longGate.why);
  else if (leanShort && !shortGate.ok) reasons.push(shortGate.why);

  const bullRegime =
    ema9Now != null &&
    ema21Now != null &&
    sma50Now != null &&
    ema9Now > ema21Now &&
    price > sma50Now;
  const bearRegime =
    ema9Now != null &&
    ema21Now != null &&
    sma50Now != null &&
    ema9Now < ema21Now &&
    price < sma50Now;

  if (side === "short" && bullRegime && diverge !== "bear" && setup !== "diverge") {
    side = "wait";
    reasons.push("Blocked — still above 50 SMA");
  }
  if (side === "long" && bearRegime && diverge !== "bull" && setup !== "diverge") {
    side = "wait";
    reasons.push("Blocked — still below 50 SMA");
  }

  if (side === "wait") setup = setup === "none" ? "none" : setup;

  const confluence = side === "long" ? bulls : side === "short" ? bears : 0;
  let quality: Signal["quality"] = "—";
  if (side !== "wait") {
    const extended = atrFrac >= 1.6 && setup !== "breakout";
    if (
      (setup === "pullback" || setup === "diverge") &&
      confluence >= 4 &&
      (adxNow == null || adxNow >= 18 || setup === "diverge") &&
      !extended
    ) {
      quality = "A";
    } else if (confluence >= 3 && setup !== "none") quality = "B";
    else quality = "C";
  }

  const confidence = Math.round(
    side === "wait"
      ? clamp(Math.abs(score) * 0.4 + 16, 12, 48)
      : clamp(
          50 +
            confluence * 5 +
            (adxNow != null && adxNow >= 25 ? 6 : 0) +
            (ctx.higherSide === side ? 6 : 0) +
            (quality === "A" ? 8 : 0) +
            (setup === "pullback" || setup === "diverge" ? 4 : 0),
          46,
          96,
        ),
  );

  const atrStop = atrNow && atrNow > 0 ? atrNow * 1.5 : price * 0.016;
  const entry = price;
  let stop = side === "short" ? entry + atrStop : entry - atrStop;
  if (side === "long") {
    const swing = lastSwing(closed, "low");
    if (swing != null && swing < entry) {
      const dist = entry - swing;
      if (dist >= atrStop * 0.7 && dist <= atrStop * 2.6) stop = swing;
    }
  } else if (side === "short") {
    const swing = lastSwing(closed, "high");
    if (swing != null && swing > entry) {
      const dist = swing - entry;
      if (dist >= atrStop * 0.7 && dist <= atrStop * 2.6) stop = swing;
    }
  }
  const stopDist = Math.abs(entry - stop);
  const target = side === "short" ? entry - stopDist * 1.85 : entry + stopDist * 1.85;

  let emaBias: Signal["emaBias"] = "flat";
  if (ema9Now != null && ema21Now != null) {
    const gap = Math.abs(ema9Now - ema21Now) / Math.max(price, 1e-9);
    if (gap > 0.0004) emaBias = ema9Now > ema21Now ? "bull" : "bear";
  }

  const uniqueReasons = reasons.filter((r, i, arr) => arr.indexOf(r) === i).slice(0, 4);
  if (rsiNow != null && !uniqueReasons.some((r) => r.startsWith("RSI"))) {
    uniqueReasons.unshift(`RSI ${rsiNow.toFixed(0)}`);
    if (uniqueReasons.length > 4) uniqueReasons.pop();
  }
  if (uniqueReasons.length === 0) uniqueReasons.push("No dominant setup on this scan");

  return {
    side,
    confidence,
    score: Math.round(score),
    reasons: uniqueReasons,
    entry: roundPx(entry),
    stop: roundPx(stop),
    target: roundPx(target),
    rsi: rsiNow != null ? Math.round(rsiNow * 10) / 10 : null,
    macdHist: histNow != null ? histNow : null,
    emaBias,
    volumeRatio: volumeRatio != null ? Math.round(volumeRatio * 100) / 100 : null,
    atr: atrNow,
    quality,
    setup,
    adx: adxNow != null ? Math.round(adxNow * 10) / 10 : null,
  };
}

export function applyTapeContext(markets: MarketRow[]): void {
  if (markets.length < 8) return;
  const chgs = markets.map((m) => m.changePct).sort((a, b) => a - b);
  const median = chgs[Math.floor(chgs.length / 2)] ?? 0;
  for (const row of markets) {
    const rel = row.changePct - median;
    const { signal } = row;
    if (signal.side === "wait" || signal.quality === "A") continue;
    if (signal.side === "long" && rel < -1.6) {
      signal.side = "wait";
      signal.quality = "—";
      signal.confidence = Math.min(signal.confidence, 36);
      signal.reasons = [`Lagging the tape ${rel.toFixed(1)}pp`, ...signal.reasons].slice(0, 4);
    } else if (signal.side === "short" && rel > 1.6) {
      signal.side = "wait";
      signal.quality = "—";
      signal.confidence = Math.min(signal.confidence, 36);
      signal.reasons = [`Holding vs tape +${rel.toFixed(1)}pp`, ...signal.reasons].slice(0, 4);
    }
  }
}

const MIN_RATE_CLOSED = 5;

export function emptyHitStats(): HitStats {
  return { closed: 0, wins: 0, losses: 0, open: 0, winRate: null, expectancyR: null };
}

export function mergeHitStats(rows: HitStats[]): HitStats {
  let wins = 0;
  let losses = 0;
  let open = 0;
  for (const row of rows) {
    wins += row.wins;
    losses += row.losses;
    open += row.open;
  }
  const closed = wins + losses;
  return {
    closed,
    wins,
    losses,
    open,
    winRate: closed >= 8 ? Math.round((wins / closed) * 100) : null,
    expectancyR:
      closed >= 8 ? Math.round(((wins * 1.85 - losses) / closed) * 100) / 100 : null,
  };
}

export function backtestHits(candles: Candle[]): HitStats {
  if (candles.length < 56) return emptyHitStats();

  let i = 50;
  let wins = 0;
  let losses = 0;
  let open = 0;

  while (i < candles.length - 1) {
    const sig = evaluateSignal(candles.slice(0, i + 1));
    if (sig.side === "wait") {
      i += 1;
      continue;
    }

    let resolved: "win" | "loss" | "open" = "open";
    let j = i + 1;
    for (; j < candles.length; j++) {
      const bar = candles[j]!;
      if (sig.side === "long") {
        const stopHit = bar.l <= sig.stop;
        const targetHit = bar.h >= sig.target;
        if (stopHit && targetHit) {
          resolved = "loss";
          break;
        }
        if (stopHit) {
          resolved = "loss";
          break;
        }
        if (targetHit) {
          resolved = "win";
          break;
        }
      } else {
        const stopHit = bar.h >= sig.stop;
        const targetHit = bar.l <= sig.target;
        if (stopHit && targetHit) {
          resolved = "loss";
          break;
        }
        if (stopHit) {
          resolved = "loss";
          break;
        }
        if (targetHit) {
          resolved = "win";
          break;
        }
      }
    }

    if (resolved === "win") wins += 1;
    else if (resolved === "loss") losses += 1;
    else open += 1;

    if (resolved === "open") break;
    i = j + 1;
  }

  const closed = wins + losses;
  return {
    closed,
    wins,
    losses,
    open,
    winRate: closed >= MIN_RATE_CLOSED ? Math.round((wins / closed) * 100) : null,
    expectancyR:
      closed >= MIN_RATE_CLOSED
        ? Math.round(((wins * 1.85 - losses) / closed) * 100) / 100
        : null,
  };
}

