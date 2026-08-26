import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  approvedCalls,
  formatCallMessage,
  formatCloseMessage,
  localAnalystCopy,
  scanLine,
  tapeFingerprint,
} from "@/lib/agents/policy";
import type { AgentEvent, AnalystNote } from "@/lib/agents/types";
import { deskAccount, STARTING_CASH } from "@/lib/market/account";
import {
  canBook,
  markBlotter,
  openFill,
} from "@/lib/market/blotter";
import { loadMarket } from "@/lib/market/load-market";
import type { PaperFill } from "@/lib/market/types";
import type { Interval } from "@/lib/market/universe";
import { clampRisk, DEFAULT_RISK, type RiskParams } from "@/lib/risk/params";

const STATE_PATH = join(process.cwd(), "data", "desk-runtime.json");
const TG_PATH = join(process.cwd(), "data", "telegram.json");
const TICK_MS = 15_000;
const BRIEF_EVERY_MS = 90_000;
const MAX_EVENTS = 40;
const MAX_FILLS = 80;

export type RuntimeConfig = {
  interval: Interval;
  riskUsd: number;
  risk: RiskParams;
  autopilot: boolean;
  mode: "paper" | "live";
  telegramOn: boolean;
  telegramToken: string;
  telegramChatId: string;
  binanceKey: string;
  binanceSecret: string;
  binanceTestnet: boolean;
};

export type RuntimeState = RuntimeConfig & {
  paperCash: number;
  fills: PaperFill[];
  events: AgentEvent[];
  analyst: AnalystNote | null;
  analystStatus: "idle" | "reading" | "live" | "offline";
  lastKeys: string[];
  lastPrint: string;
  lastScanAt: number;
  lastTickAt: number;
  lastBriefAt: number;
  lastError: string | null;
  running: boolean;
};

type Bag = {
  state: RuntimeState;
  timer: ReturnType<typeof setInterval> | null;
  ticking: boolean;
  started: boolean;
};

function emptyState(): RuntimeState {
  return {
    interval: "1h",
    riskUsd: DEFAULT_RISK.riskUsd,
    risk: { ...DEFAULT_RISK },
    autopilot: true,
    mode: "paper",
    telegramOn: true,
    telegramToken: "",
    telegramChatId: "",
    binanceKey: "",
    binanceSecret: "",
    binanceTestnet: true,
    paperCash: STARTING_CASH,
    fills: [],
    events: [],
    analyst: null,
    analystStatus: "idle",
    lastKeys: [],
    lastPrint: "",
    lastScanAt: 0,
    lastTickAt: 0,
    lastBriefAt: 0,
    lastError: null,
    running: false,
  };
}

function bag(): Bag {
  const g = globalThis as typeof globalThis & { __meridianRuntime2?: Bag };
  if (!g.__meridianRuntime2) {
    g.__meridianRuntime2 = {
      state: emptyState(),
      timer: null,
      ticking: false,
      started: false,
    };
  }
  return g.__meridianRuntime2;
}

function eventId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pushEvent(
  state: RuntimeState,
  event: Omit<AgentEvent, "id">,
): AgentEvent {
  const next: AgentEvent = { ...event, id: eventId() };
  state.events = [next, ...state.events].slice(0, MAX_EVENTS);
  return next;
}

async function persist(state: RuntimeState) {
  try {
    await mkdir(join(process.cwd(), "data"), { recursive: true });
    await writeFile(STATE_PATH, JSON.stringify(state), "utf8");
  } catch {
    /* ignore */
  }
}

function envTelegram() {
  return {
    token: String(process.env.TELEGRAM_BOT_TOKEN ?? process.env.TG_BOT_TOKEN ?? "").trim(),
    chatId: String(process.env.TELEGRAM_CHAT_ID ?? process.env.TG_CHAT_ID ?? "").trim(),
  };
}

async function overlayTelegram() {
  try {
    const raw = JSON.parse(await readFile(TG_PATH, "utf8")) as {
      token?: unknown;
      chatId?: unknown;
    };
    return {
      token: String(raw.token ?? "").trim(),
      chatId: String(raw.chatId ?? "").trim(),
    };
  } catch {
    return { token: "", chatId: "" };
  }
}

async function writeTelegramOverlay(token: string, chatId: string) {
  try {
    await mkdir(join(process.cwd(), "data"), { recursive: true });
    await writeFile(TG_PATH, JSON.stringify({ token, chatId }), "utf8");
  } catch {
    /* ignore */
  }
}

async function resolveTelegram(state: RuntimeState) {
  const overlay = await overlayTelegram();
  const env = envTelegram();
  const token = state.telegramToken || overlay.token || env.token;
  const chatId = state.telegramChatId || overlay.chatId || env.chatId;
  if (token && !state.telegramToken) state.telegramToken = token;
  if (chatId && !state.telegramChatId) state.telegramChatId = chatId;
  return { token, chatId };
}

async function restore() {
  try {
    const raw = await readFile(STATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<RuntimeState>;
    const base = emptyState();
    bag().state = {
      ...base,
      ...parsed,
      risk: clampRisk({ ...DEFAULT_RISK, ...parsed.risk, riskUsd: parsed.riskUsd ?? parsed.risk?.riskUsd }),
      running: false,
      events: Array.isArray(parsed.events) ? parsed.events.slice(0, MAX_EVENTS) : [],
      fills: Array.isArray(parsed.fills) ? parsed.fills.slice(0, MAX_FILLS) : [],
    };
    const overlay = await overlayTelegram();
    const env = envTelegram();
    if (!bag().state.telegramToken) {
      bag().state.telegramToken = overlay.token || env.token;
    }
    if (!bag().state.telegramChatId) {
      bag().state.telegramChatId = overlay.chatId || env.chatId;
    }
  } catch {
    /* first run */
  }
}

async function pingTelegram(state: RuntimeState, text: string) {
  if (!state.telegramOn) return;
  const { token, chatId } = await resolveTelegram(state);
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    /* keep looping */
  }
}

export async function telegramCreds(state: RuntimeState = bag().state) {
  return resolveTelegram(state);
}

export function publicRuntime(state: RuntimeState = bag().state) {
  const env = envTelegram();
  const linked = Boolean(
    (state.telegramToken || env.token) && (state.telegramChatId || env.chatId),
  );
  return {
    running: state.running,
    interval: state.interval,
    riskUsd: state.riskUsd,
    risk: state.risk,
    autopilot: state.autopilot,
    mode: state.mode,
    telegramOn: state.telegramOn,
    telegramLinked: linked,
    liveArmed: state.mode === "live" && Boolean(state.binanceKey),
    testnet: state.binanceTestnet,
    paperCash: state.paperCash,
    fills: state.fills,
    events: state.events,
    analyst: state.analyst,
    analystStatus: state.analystStatus,
    lastTickAt: state.lastTickAt,
    lastError: state.lastError,
    openCount: state.fills.filter((f) => f.result === "open").length,
  };
}

export function applyConfig(patch: Partial<RuntimeConfig>) {
  const state = bag().state;
  if (patch.interval) state.interval = patch.interval;
  if (patch.risk) {
    state.risk = clampRisk({ ...state.risk, ...patch.risk, riskUsd: patch.riskUsd ?? patch.risk.riskUsd });
    state.riskUsd = state.risk.riskUsd;
  } else if (patch.riskUsd != null && Number.isFinite(patch.riskUsd)) {
    state.risk = clampRisk({ ...state.risk, riskUsd: patch.riskUsd });
    state.riskUsd = state.risk.riskUsd;
  }
  if (patch.autopilot != null) state.autopilot = patch.autopilot;
  if (patch.mode) state.mode = patch.mode;
  if (patch.telegramOn != null) state.telegramOn = patch.telegramOn;
  if (patch.telegramToken) state.telegramToken = patch.telegramToken.trim();
  if (patch.telegramChatId) state.telegramChatId = patch.telegramChatId.trim();
  if (state.telegramToken && state.telegramChatId) {
    void writeTelegramOverlay(state.telegramToken, state.telegramChatId);
  }
  if (patch.binanceKey) state.binanceKey = patch.binanceKey.trim();
  if (patch.binanceSecret) state.binanceSecret = patch.binanceSecret.trim();
  if (patch.binanceTestnet != null) state.binanceTestnet = patch.binanceTestnet;
  void persist(state);
  return publicRuntime(state);
}

export async function tickOnce() {
  const b = bag();
  if (b.ticking) return publicRuntime();
  b.ticking = true;
  const state = b.state;
  try {
    await resolveTelegram(state);
    if (!state.autopilot) {
      state.lastTickAt = Date.now();
      state.running = true;
      return publicRuntime();
    }

    const snapshot = await Promise.race([
      loadMarket(state.interval, {
        aiAvailable: Boolean(process.env.XAI_API_KEY),
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Scan timeout")), 18_000);
      }),
    ]);

    const prev = state.fills;
    const marked = markBlotter(prev, snapshot.markets);
    const prevById = new Map(prev.map((f) => [f.id, f]));
    const closed: PaperFill[] = [];
    let cash = state.paperCash;
    state.fills = marked.map((f) => {
      const old = prevById.get(f.id);
      if (old?.result === "open" && f.result !== "open") {
        const pnl = f.pnlUsd ?? (f.r ?? 0) * f.riskUsd;
        cash += pnl;
        const done = { ...f, pnlUsd: pnl };
        closed.push(done);
        return done;
      }
      return f;
    });
    state.paperCash = Math.round(cash * 100) / 100;

    for (const fill of closed) {
      pushEvent(state, {
        at: Date.now(),
        agent: "risk",
        title: `Closed ${fill.base} ${fill.result}`,
        detail: `${fill.r ?? 0}R · $${(fill.pnlUsd ?? 0).toFixed(2)}`,
        tone: fill.result === "win" ? "long" : "short",
        symbol: fill.symbol,
      });
      await pingTelegram(state, formatCloseMessage(fill));
    }

    const scanChanged = snapshot.generatedAt !== state.lastScanAt;
    if (scanChanged) {
      state.lastScanAt = snapshot.generatedAt;
      const scan = scanLine(snapshot);
      pushEvent(state, {
        at: snapshot.generatedAt,
        agent: "scanner",
        title: scan.title,
        detail: scan.detail,
        tone: "neutral",
      });
    }

    const approved = approvedCalls(snapshot.markets, state.risk);
    const fp = tapeFingerprint(approved);
    const nextKeys = approved.map((r) => `${r.symbol}:${r.signal.side}`);
    const prevKeys = new Set(state.lastKeys);
    const fresh = approved.filter((r) => !prevKeys.has(`${r.symbol}:${r.signal.side}`));
    state.lastKeys = nextKeys;

    if (fp !== state.lastPrint) {
      state.lastPrint = fp;
      if (approved.length === 0) {
        if (scanChanged) {
          pushEvent(state, {
            at: Date.now(),
            agent: "risk",
            title: "No calls cleared",
            detail: "Confidence, higher TF, or chop gate.",
            tone: "wait",
          });
        }
      } else {
        const lead = approved[0]!;
        pushEvent(state, {
          at: Date.now(),
          agent: "risk",
          title: `Approved ${lead.base} ${lead.signal.side}`,
          detail: approved
            .slice(0, 4)
            .map((r) => `${r.base} ${r.signal.side} ${r.signal.confidence}`)
            .join(" · "),
          tone: lead.signal.side === "short" ? "short" : "long",
          symbol: lead.symbol,
        });
      }
    }

    const equity = deskAccount(state.fills, snapshot.markets, state.paperCash).equity;
    for (const row of fresh) {
      const gate = canBook(state.fills, state.paperCash, equity, row.symbol, state.risk);
      if (!gate.ok) {
        pushEvent(state, {
          at: Date.now(),
          agent: "risk",
          title: `Held ${row.base}`,
          detail: gate.reason,
          tone: "wait",
          symbol: row.symbol,
        });
        continue;
      }
      const venue = state.mode === "live" ? "live" : "paper";
      const fill = openFill(row, snapshot.interval, state.risk, equity, venue);
      if (!fill) continue;
      state.fills = [fill, ...state.fills].slice(0, MAX_FILLS);
      await pingTelegram(
        state,
        formatCallMessage(row, snapshot.interval, fill.qty, fill.riskUsd, state.mode),
      );

      if (state.mode === "live" && row.signal.side === "long" && state.binanceKey && state.binanceSecret) {
        const { submitSpotOrder } = await import("@/lib/exchange/spot");
        const result = await submitSpotOrder({
          apiKey: state.binanceKey,
          apiSecret: state.binanceSecret,
          symbol: row.symbol,
          side: "BUY",
          quantity: fill.qty,
          price: row.price,
          testnet: state.binanceTestnet,
        });
        if (result.ok) {
          fill.liveOrderId = result.orderId;
        } else {
          fill.liveError = result.error;
          fill.venue = "paper";
        }
      } else if (state.mode === "live" && row.signal.side === "short") {
        fill.liveError = "Spot live does not short. Booked as paper.";
        fill.venue = "paper";
      }
    }

    const copy = localAnalystCopy(approved);
    state.analyst = {
      at: snapshot.generatedAt,
      headline: copy.headline,
      notes: copy.notes,
      stance: copy.stance,
      focus: copy.focus,
    };

    if (!snapshot.aiAvailable) {
      state.analystStatus = "offline";
    } else if (
      Date.now() - state.lastBriefAt >= BRIEF_EVERY_MS &&
      approved.length > 0
    ) {
      state.lastBriefAt = Date.now();
      state.analystStatus = "reading";
      try {
        const { requestBriefing } = await import("@/lib/ai/briefing");
        const result = await requestBriefing({
          data: {
            interval: snapshot.interval,
            rows: approved.slice(0, 8).map((m) => ({
              base: m.base,
              side: m.signal.side,
              confidence: m.signal.confidence,
              price: m.price,
              changePct: m.changePct,
              reasons: m.signal.reasons,
              rsi: m.signal.rsi,
            })),
          },
        });
        if (result.ok) {
          state.analystStatus = "live";
          state.analyst = {
            at: Date.now(),
            headline: result.headline,
            notes: result.text,
            stance: result.stance,
            focus: result.focus,
          };
          pushEvent(state, {
            at: Date.now(),
            agent: "analyst",
            title: result.headline,
            detail: result.text,
            tone:
              result.stance === "risk-on"
                ? "long"
                : result.stance === "risk-off"
                  ? "short"
                  : "neutral",
          });
        } else {
          state.analystStatus = "offline";
        }
      } catch {
        state.analystStatus = "offline";
      }
    }

    state.lastTickAt = Date.now();
    state.lastError = null;
    state.running = true;
    await persist(state);
  } catch (err) {
    state.lastError = err instanceof Error ? err.message : "Tick failed";
    state.lastTickAt = Date.now();
    state.running = true;
  } finally {
    b.ticking = false;
  }
  return publicRuntime();
}

export async function ensureRuntime() {
  const b = bag();
  if (b.started) return publicRuntime();
  b.started = true;
  await restore();
  try {
    const { startPriceStream } = await import("@/lib/market/stream");
    startPriceStream();
  } catch {
    /* stream is best-effort */
  }
  b.state.running = true;
  if (!b.timer) {
    b.timer = setInterval(() => {
      void tickOnce();
    }, TICK_MS);
    b.timer.unref?.();
  }
  void tickOnce();
  return publicRuntime();
}

export function resetPaperRuntime() {
  const state = bag().state;
  state.paperCash = STARTING_CASH;
  state.fills = [];
  state.lastKeys = [];
  state.lastPrint = "";
  void persist(state);
  return publicRuntime();
}
