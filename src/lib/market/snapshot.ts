import { createServerFn } from "@tanstack/react-start";
import { loadMarket, loadQuotes } from "./load-market";
import type { LiveQuote } from "./live";
import type { MarketSnapshot } from "./types";
import type { Interval } from "./universe";

const INTERVALS = new Set<Interval>(["15m", "1h", "4h", "1d"]);

function parseInterval(input: unknown): Interval {
  const interval =
    typeof input === "object" && input !== null && "interval" in input
      ? String((input as { interval: unknown }).interval)
      : "1h";
  if (!INTERVALS.has(interval as Interval)) {
    throw new Error("Invalid interval");
  }
  return interval as Interval;
}

export const getMarketSnapshot = createServerFn({ method: "GET" })
  .validator((input: unknown) => ({ interval: parseInterval(input) }))
  .handler(async ({ data }): Promise<MarketSnapshot> => {
    try {
      const { ensureRuntime } = await import("@/lib/agents/runtime");
      void ensureRuntime();
    } catch {
      /* runtime is best-effort */
    }
    return loadMarket(data.interval, {
      aiAvailable: Boolean(process.env.XAI_API_KEY),
    });
  });

export const getLiveQuotes = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ at: number; quotes: LiveQuote[] }> => {
    const quotes = await loadQuotes();
    return { at: Date.now(), quotes };
  },
);
