import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AgentEvent, AnalystNote } from "@/lib/agents/types";
import { STARTING_CASH } from "@/lib/market/account";
import { canBook, fillKey, markBlotter, openFill } from "@/lib/market/blotter";
import type { MarketRow, PaperFill } from "@/lib/market/types";
import { DEFAULT_WATCHLIST, type Interval } from "@/lib/market/universe";
import { clampRisk, DEFAULT_RISK, type RiskParams } from "@/lib/risk/params";

export type SignalFilter = "all" | "long" | "short" | "wait" | "watch" | "calls";
export type DeskMode = "paper" | "live";

type DeskState = {
  watchlist: string[];
  interval: Interval;
  filter: SignalFilter;
  selected: string | null;
  autopilot: boolean;
  mode: DeskMode;
  paperCash: number;
  riskUsd: number;
  risk: RiskParams;
  soundOn: boolean;
  whatsappOn: boolean;
  telegramOn: boolean;
  telegramToken: string;
  telegramChatId: string;
  binanceKey: string;
  binanceSecret: string;
  binanceTestnet: boolean;
  events: AgentEvent[];
  fills: PaperFill[];
  analyst: AnalystNote | null;
  analystStatus: "idle" | "reading" | "live" | "offline";
  setInterval: (interval: Interval) => void;
  setFilter: (filter: SignalFilter) => void;
  setSelected: (symbol: string | null) => void;
  setAutopilot: (on: boolean) => void;
  setMode: (mode: DeskMode) => void;
  setRiskUsd: (n: number) => void;
  setRisk: (patch: Partial<RiskParams>) => void;
  setSoundOn: (on: boolean) => void;
  setWhatsappOn: (on: boolean) => void;
  setTelegramOn: (on: boolean) => void;
  setTelegramToken: (token: string) => void;
  setTelegramChatId: (id: string) => void;
  setBinanceKey: (key: string) => void;
  setBinanceSecret: (secret: string) => void;
  setBinanceTestnet: (on: boolean) => void;
  resetPaper: () => void;
  toggleWatch: (symbol: string) => void;
  addWatch: (symbol: string) => void;
  pushEvent: (event: Omit<AgentEvent, "id">) => void;
  setAnalyst: (note: AnalystNote | null) => void;
  setAnalystStatus: (status: DeskState["analystStatus"]) => void;
  applyRuntime: (payload: {
    paperCash: number;
    fills: PaperFill[];
    events: AgentEvent[];
    analyst: AnalystNote | null;
    analystStatus: DeskState["analystStatus"];
  }) => void;
  hydrated: boolean;
  setHydrated: (on: boolean) => void;
  bookCall: (row: MarketRow, interval: Interval) => PaperFill | null;
  patchFill: (id: string, patch: Partial<PaperFill>) => void;
  markTape: (markets: MarketRow[]) => PaperFill[];
};

function eventId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const useDesk = create<DeskState>()(
  persist(
    (set, get) => ({
      watchlist: [...DEFAULT_WATCHLIST],
      interval: "1h",
      filter: "calls",
      selected: null,
      autopilot: true,
      mode: "paper",
      paperCash: STARTING_CASH,
      riskUsd: DEFAULT_RISK.riskUsd,
      risk: { ...DEFAULT_RISK },
      soundOn: true,
      whatsappOn: false,
      telegramOn: true,
      telegramToken: "",
      telegramChatId: "",
      binanceKey: "",
      binanceSecret: "",
      binanceTestnet: true,
      events: [],
      fills: [],
      analyst: null,
      analystStatus: "idle",
      hydrated: true,
      setInterval: (interval) => set({ interval }),
      setFilter: (filter) => set({ filter }),
      setSelected: (selected) => set({ selected }),
      setAutopilot: (autopilot) => set({ autopilot }),
      setMode: (mode) => set({ mode }),
      setRiskUsd: (riskUsd) => {
        const risk = clampRisk({ ...DEFAULT_RISK, ...get().risk, riskUsd });
        set({ riskUsd: risk.riskUsd, risk });
      },
      setRisk: (patch) => {
        const risk = clampRisk({ ...DEFAULT_RISK, ...get().risk, ...patch });
        set({ risk, riskUsd: risk.riskUsd });
      },
      setSoundOn: (soundOn) => set({ soundOn }),
      setWhatsappOn: (whatsappOn) => set({ whatsappOn }),
      setTelegramOn: (telegramOn) => set({ telegramOn }),
      setTelegramToken: (telegramToken) => set({ telegramToken }),
      setTelegramChatId: (telegramChatId) => set({ telegramChatId }),
      setBinanceKey: (binanceKey) => set({ binanceKey }),
      setBinanceSecret: (binanceSecret) => set({ binanceSecret }),
      setBinanceTestnet: (binanceTestnet) => set({ binanceTestnet }),
      resetPaper: () => set({ paperCash: STARTING_CASH, fills: [] }),
      setHydrated: (hydrated) => set({ hydrated }),
      applyRuntime: (payload) => {
        const local = get().fills;
        const localIds = new Set(local.map((f) => f.id));
        const openSymbols = new Set(
          local.filter((f) => f.result === "open").map((f) => f.symbol),
        );
        const extra = payload.fills.filter(
          (f) =>
            !localIds.has(f.id) &&
            !(f.result === "open" && openSymbols.has(f.symbol)),
        );
        const eventsById = new Map(get().events.map((e) => [e.id, e]));
        for (const event of payload.events) eventsById.set(event.id, event);
        const events = [...eventsById.values()]
          .sort((a, b) => b.at - a.at)
          .slice(0, 40);
        set({
          fills: extra.length > 0 ? [...extra, ...local].slice(0, 80) : local,
          events,
          analyst: payload.analyst ?? get().analyst,
          analystStatus: payload.analystStatus,
        });
      },
      toggleWatch: (symbol) => {
        const { watchlist } = get();
        set({
          watchlist: watchlist.includes(symbol)
            ? watchlist.filter((s) => s !== symbol)
            : [...watchlist, symbol],
        });
      },
      addWatch: (symbol) => {
        const { watchlist } = get();
        if (watchlist.includes(symbol)) return;
        set({ watchlist: [...watchlist, symbol] });
      },
      pushEvent: (event) => {
        const next: AgentEvent = { ...event, id: eventId() };
        const events = [next, ...get().events].slice(0, 40);
        set({ events });
      },
      setAnalyst: (analyst) => set({ analyst }),
      setAnalystStatus: (analystStatus) => set({ analystStatus }),
      bookCall: (row, interval) => {
        if (row.signal.side === "wait") return null;
        const params = clampRisk(get().risk);
        const equity = get().paperCash;
        const gate = canBook(get().fills, get().paperCash, equity, row.symbol, params);
        if (!gate.ok) return null;
        const key = fillKey(row.symbol);
        const exists = get().fills.some(
          (f) => f.result === "open" && fillKey(f.symbol) === key,
        );
        if (exists) return null;
        const venue = get().mode === "live" ? "live" : "paper";
        const fill = openFill(row, interval, params, equity, venue);
        if (!fill) return null;
        set({ fills: [fill, ...get().fills].slice(0, 80) });
        return fill;
      },
      patchFill: (id, patch) => {
        set({
          fills: get().fills.map((f) => (f.id === id ? { ...f, ...patch } : f)),
        });
      },
      markTape: (markets) => {
        const prev = get().fills;
        const marked = markBlotter(prev, markets);
        const prevById = new Map(prev.map((f) => [f.id, f]));
        let cash = get().paperCash;
        const closed: PaperFill[] = [];
        const fills = marked.map((f) => {
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
        set({ fills, paperCash: Math.round(cash * 100) / 100 });
        return closed;
      },
    }),
    {
      name: "meridian-desk",
      skipHydration: true,
      partialize: (s) => ({
        watchlist: s.watchlist,
        interval: s.interval,
        filter: s.filter === "calls" ? "calls" : s.filter,
        autopilot: s.autopilot,
        mode: s.mode,
        paperCash: s.paperCash,
        riskUsd: s.riskUsd,
        risk: s.risk,
        soundOn: s.soundOn,
        whatsappOn: s.whatsappOn,
        telegramOn: s.telegramOn,
        telegramToken: s.telegramToken,
        telegramChatId: s.telegramChatId,
        binanceKey: s.binanceKey,
        binanceSecret: s.binanceSecret,
        binanceTestnet: s.binanceTestnet,
        fills: s.fills,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<DeskState>;
        const risk = clampRisk({
          ...DEFAULT_RISK,
          ...p.risk,
          riskUsd: p.riskUsd ?? p.risk?.riskUsd,
        });
        const fills =
          current.fills.length > 0
            ? current.fills
            : Array.isArray(p.fills)
              ? p.fills
              : current.fills;
        const events = current.events.length > 0 ? current.events : (p.events ?? current.events);
        return {
          ...current,
          ...p,
          risk,
          riskUsd: risk.riskUsd,
          fills,
          events,
          hydrated: current.hydrated,
        };
      },
    },
  ),
);
