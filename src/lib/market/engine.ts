import type { Candle, HitStats, Signal, Side } from "./types";

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

export function evaluateSignal(candles: Candle[]): Signal {
  const closes = candles.map((c) => c.c);
  const closed = candles.length > 1 ? candles.slice(0, -1) : candles;
  const volumes = closed.map((c) => c.v);
  const last = candles[candles.length - 1];
  const price = last?.c ?? 0;

  const rsiArr = rsi(closes, 14);
  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const sma50 = sma(closes, 50);
  const macdRes = macd(closes);
  const atrArr = atr(candles, 14);
  const volSma = sma(volumes, 20);

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

  if (rsiNow != null) {
    if (rsiNow < 30) {
      score += 26;
      reasons.push(`RSI ${rsiNow.toFixed(0)} — oversold`);
    } else if (rsiNow < 40) {
      score += 12;
      reasons.push(`RSI ${rsiNow.toFixed(0)} — weak`);
    } else if (rsiNow > 70) {
      score -= 26;
      reasons.push(`RSI ${rsiNow.toFixed(0)} — overbought`);
    } else if (rsiNow > 60) {
      score -= 12;
      reasons.push(`RSI ${rsiNow.toFixed(0)} — stretched`);
    }
  }

  const emaCross = recentCross(ema9, ema21, 4);
  if (ema9Now != null && ema21Now != null) {
    if (ema9Now > ema21Now) {
      score += 16;
      if (emaCross === "bull") {
        score += 10;
        reasons.push("EMA 9 crossed above 21");
      } else {
        reasons.push("EMA stack is bullish");
      }
    } else {
      score -= 16;
      if (emaCross === "bear") {
        score -= 10;
        reasons.push("EMA 9 crossed below 21");
      } else {
        reasons.push("EMA stack is bearish");
      }
    }
  }

  if (histNow != null) {
    if (histNow > 0) {
      score += 12;
      if (histPrev != null && histPrev <= 0) {
        score += 8;
        reasons.push("MACD histogram flipped positive");
      } else if (histPrev != null && histNow > histPrev) {
        score += 4;
        reasons.push("MACD momentum expanding");
      }
    } else {
      score -= 12;
      if (histPrev != null && histPrev >= 0) {
        score -= 8;
        reasons.push("MACD histogram flipped negative");
      } else if (histPrev != null && histNow < histPrev) {
        score -= 4;
        reasons.push("MACD momentum fading");
      }
    }
  }

  if (sma50Now != null && price > 0) {
    const dist = ((price - sma50Now) / sma50Now) * 100;
    if (price > sma50Now) {
      score += 10;
      if (Math.abs(dist) > 1) reasons.push("Price holding above 50 SMA");
    } else {
      score -= 10;
      if (Math.abs(dist) > 1) reasons.push("Price trading below 50 SMA");
    }
  }

  if (volumeRatio != null) {
    if (volumeRatio >= 1.8) {
      score += score >= 0 ? 8 : -8;
      reasons.push(`Volume ${volumeRatio.toFixed(1)}× average`);
    } else if (volumeRatio <= 0.6) {
      score *= 0.85;
    }
  }

  if (closes.length > 10) {
    const prev = closes[closes.length - 11]!;
    if (prev > 0) {
      const mom = ((price - prev) / prev) * 100;
      score += clamp(mom * 1.4, -12, 12);
      if (Math.abs(mom) >= 3) {
        reasons.push(`10-bar momentum ${mom > 0 ? "+" : ""}${mom.toFixed(1)}%`);
      }
    }
  }

  score = clamp(score, -100, 100);

  const trendAgree =
    ema9Now != null &&
    ema21Now != null &&
    histNow != null &&
    ((score > 0 && ema9Now > ema21Now && histNow > 0) ||
      (score < 0 && ema9Now < ema21Now && histNow < 0));

  let side: Side = "wait";
  if (score >= 28 || (score >= 20 && trendAgree)) side = "long";
  else if (score <= -28 || (score <= -20 && trendAgree)) side = "short";

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

  if (side === "short" && bullRegime && score > -50 && (rsiNow == null || rsiNow < 70)) {
    side = "wait";
    reasons.push("Blocked — still above 50 SMA");
  }
  if (side === "long" && bearRegime && score < 50 && (rsiNow == null || rsiNow > 30)) {
    side = "wait";
    reasons.push("Blocked — still below 50 SMA");
  }

  const confidence = Math.round(
    clamp(Math.abs(score) * (side === "wait" ? 0.55 : 0.92) + (side === "wait" ? 18 : 8), 12, 96),
  );

  const stopDist = atrNow && atrNow > 0 ? atrNow * 1.6 : price * 0.018;
  const targetDist = stopDist * 1.85;
  const entry = price;
  const stop = side === "short" ? entry + stopDist : entry - stopDist;
  const target = side === "short" ? entry - targetDist : entry + targetDist;

  let emaBias: Signal["emaBias"] = "flat";
  if (ema9Now != null && ema21Now != null) {
    const gap = Math.abs(ema9Now - ema21Now) / Math.max(price, 1e-9);
    if (gap > 0.0004) emaBias = ema9Now > ema21Now ? "bull" : "bear";
  }

  const uniqueReasons = reasons.filter((r, i, arr) => arr.indexOf(r) === i).slice(0, 3);
  if (rsiNow != null && !uniqueReasons.some((r) => r.startsWith("RSI"))) {
    uniqueReasons.unshift(`RSI ${rsiNow.toFixed(0)}`);
    if (uniqueReasons.length > 3) uniqueReasons.pop();
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
  };
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

