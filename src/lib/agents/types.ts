export type AgentId = "scanner" | "risk" | "analyst";

export type AgentStance = "risk-on" | "mixed" | "risk-off";

export type AgentEvent = {
  id: string;
  at: number;
  agent: AgentId;
  title: string;
  detail: string;
  tone: "long" | "short" | "wait" | "neutral";
  symbol?: string;
};

export type AnalystNote = {
  at: number;
  headline: string;
  notes: string;
  stance: AgentStance;
  focus: string[];
};
