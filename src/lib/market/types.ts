import type { Interval } from "./universe";

export type Side = "long" | "short" | "wait";

export type Candle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

export type SignalQuality = "A" | "B" | "C" | "—";
export type SignalSetup = "pullback" | "breakout" | "diverge" | "trend" | "none";

export type Signal = {
  side: Side;
  confidence: number;
  score: number;
  reasons: string[];
  entry: number;
  stop: number;
  target: number;
  rsi: number | null;
  macdHist: number | null;
  emaBias: "bull" | "bear" | "flat";
  volumeRatio: number | null;
  atr: number | null;
  quality: SignalQuality;
  setup: SignalSetup;
  adx: number | null;
};

export type HitStats = {
  closed: number;
  wins: number;
  losses: number;
  open: number;
  winRate: number | null;
  expectancyR: number | null;
};

export type AlignState = "aligned" | "against" | "pending" | "none";

export type Breadth = {
  longs: number;
  shorts: number;
  waits: number;
  aligned: number;
  pending: number;
  against: number;
};

export type MarketRow = {
  symbol: string;
  base: string;
  name: string;
  price: number;
  changePct: number;
  high: number;
  low: number;
  volume: number;
  quoteVolume: number;
  candles: Candle[];
  signal: Signal;
  stats: HitStats;
  higherInterval: Interval | null;
  higherSide: Side | null;
  alignState: AlignState;
  aligned: boolean;
  chop: boolean;
  atrPct: number | null;
};

export type MarketSnapshot = {
  generatedAt: number;
  quotedAt: number;
  interval: Interval;
  markets: MarketRow[];
  aiAvailable: boolean;
  source: string;
  deskStats: HitStats;
  breadth: Breadth;
};

export type PaperFill = {
  id: string;
  symbol: string;
  base: string;
  side: Exclude<Side, "wait">;
  interval: Interval;
  entry: number;
  stop: number;
  target: number;
  qty: number;
  riskUsd: number;
  rewardR: number;
  openedAt: number;
  closedAt: number | null;
  result: "open" | "win" | "loss";
  r: number | null;
  pnlUsd: number | null;
  venue: "paper" | "live";
  liveOrderId: string | null;
  liveError: string | null;
};
