import { createServerFn } from "@tanstack/react-start";
import type { RuntimeConfig } from "./runtime";
import type { Interval } from "@/lib/market/universe";
import { clampRisk, type RiskParams } from "@/lib/risk/params";

export const getDeskRuntime = createServerFn({ method: "GET" }).handler(
  async () => {
    const { ensureRuntime, publicRuntime } = await import("./runtime");
    await ensureRuntime();
    return publicRuntime();
  },
);

export const saveDeskConfig = createServerFn({ method: "POST" })
  .validator((input: unknown): Partial<RuntimeConfig> => {
    if (typeof input !== "object" || input === null) return {};
    const raw = input as Record<string, unknown>;
    const interval = String(raw.interval ?? "");
    const intervals = new Set(["15m", "1h", "4h", "1d"]);
    return {
      interval: intervals.has(interval) ? (interval as Interval) : undefined,
      riskUsd: raw.riskUsd != null ? Number(raw.riskUsd) : undefined,
      risk:
        raw.risk && typeof raw.risk === "object"
          ? clampRisk(raw.risk as Partial<RiskParams>)
          : undefined,
      autopilot: raw.autopilot == null ? undefined : Boolean(raw.autopilot),
      mode: raw.mode === "live" || raw.mode === "paper" ? (raw.mode as "paper" | "live") : undefined,
      telegramOn: raw.telegramOn == null ? undefined : Boolean(raw.telegramOn),
      telegramToken: raw.telegramToken ? String(raw.telegramToken) : undefined,
      telegramChatId: raw.telegramChatId ? String(raw.telegramChatId) : undefined,
      binanceKey: raw.binanceKey ? String(raw.binanceKey) : undefined,
      binanceSecret: raw.binanceSecret ? String(raw.binanceSecret) : undefined,
      binanceTestnet:
        raw.binanceTestnet == null ? undefined : Boolean(raw.binanceTestnet),
    };
  })
  .handler(async ({ data }) => {
    const { applyConfig, ensureRuntime } = await import("./runtime");
    await ensureRuntime();
    return applyConfig(data);
  });

export const resetDeskPaper = createServerFn({ method: "POST" }).handler(
  async () => {
    const { resetPaperRuntime, ensureRuntime } = await import("./runtime");
    await ensureRuntime();
    return resetPaperRuntime();
  },
);
