import { DEFAULT_RISK } from "@/lib/risk/params";

export const getDeskRuntime = async () => ({
  running: false,
  interval: "1h" as const,
  riskUsd: 100,
  risk: DEFAULT_RISK,
  autopilot: true,
  mode: "paper" as const,
  telegramOn: true,
  telegramLinked: false,
  liveArmed: false,
  testnet: true,
  paperCash: 10_000,
  fills: [],
  events: [],
  analyst: null,
  analystStatus: "idle" as const,
  lastTickAt: 0,
  lastError: null,
  openCount: 0,
});

export const saveDeskConfig = async () => getDeskRuntime();
export const resetDeskPaper = async () => getDeskRuntime();
