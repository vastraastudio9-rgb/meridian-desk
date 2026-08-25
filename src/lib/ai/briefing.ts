import { createServerFn } from "@tanstack/react-start";
import type { Side } from "@/lib/market/types";

type BriefInput = {
  interval: string;
  rows: {
    base: string;
    side: Side;
    confidence: number;
    price: number;
    changePct: number;
    reasons: string[];
    rsi: number | null;
  }[];
};

export type BriefingResult =
  | {
      ok: true;
      text: string;
      headline: string;
      stance: "risk-on" | "mixed" | "risk-off";
      focus: string[];
    }
  | { ok: false; error: string };

function parseInput(input: unknown): BriefInput {
  if (typeof input !== "object" || input === null) {
    throw new Error("Invalid briefing payload");
  }
  const raw = input as BriefInput;
  if (!Array.isArray(raw.rows) || raw.rows.length === 0) {
    throw new Error("No signals to brief");
  }
  return {
    interval: String(raw.interval ?? "1h").slice(0, 8),
    rows: raw.rows.slice(0, 12).map((r) => ({
      base: String(r.base).slice(0, 12),
      side: r.side,
      confidence: Number(r.confidence),
      price: Number(r.price),
      changePct: Number(r.changePct),
      reasons: (r.reasons ?? []).slice(0, 3).map((x) => String(x).slice(0, 80)),
      rsi: r.rsi == null ? null : Number(r.rsi),
    })),
  };
}

function parseAnalyst(text: string): {
  headline: string;
  stance: "risk-on" | "mixed" | "risk-off";
  notes: string;
  focus: string[];
} {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as {
        headline?: unknown;
        stance?: unknown;
        notes?: unknown;
        focus?: unknown;
      };
      const stance =
        parsed.stance === "risk-on" || parsed.stance === "risk-off"
          ? parsed.stance
          : "mixed";
      const focus = Array.isArray(parsed.focus)
        ? parsed.focus.map((x) => String(x).slice(0, 12)).slice(0, 4)
        : [];
      const headline =
        typeof parsed.headline === "string" && parsed.headline.trim()
          ? parsed.headline.trim().slice(0, 80)
          : "Desk note";
      const notes =
        typeof parsed.notes === "string" && parsed.notes.trim()
          ? parsed.notes.trim()
          : text;
      return { headline, stance, notes, focus };
    } catch {
      /* fall through */
    }
  }
  return {
    headline: text.slice(0, 72) || "Desk note",
    stance: "mixed",
    notes: text,
    focus: [],
  };
}

export const requestBriefing = createServerFn({ method: "POST" })
  .validator((input: unknown) => parseInput(input))
  .handler(async ({ data }): Promise<BriefingResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "AI briefing is unavailable here." };
    }

    const lines = data.rows
      .map((r) => {
        const rsi = r.rsi == null ? "n/a" : r.rsi.toFixed(0);
        return `${r.base} ${r.side.toUpperCase()} conf ${r.confidence} px ${r.price} 24h ${r.changePct.toFixed(2)}% RSI ${rsi} · ${r.reasons.join("; ")}`;
      })
      .join("\n");

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 420,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              'You are Meridian Analyst, an autonomous crypto desk agent. Reply with JSON only: {"headline":"short desk headline","stance":"risk-on"|"mixed"|"risk-off","notes":"3-5 sentences, specific names, present tense, no advice, no emojis, no markdown","focus":["TICKER"]}. No other text.',
          },
          {
            role: "user",
            content: `Timeframe ${data.interval}. Autonomous scan, no human in the loop:\n${lines}\n\nIssue the desk call.`,
          },
        ],
      }),
    });

    if (!res.ok) {
      return { ok: false as const, error: `Briefing failed (${res.status}).` };
    }

    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return { ok: false as const, error: "Empty briefing." };
    const parsed = parseAnalyst(text);
    return {
      ok: true as const,
      text: parsed.notes,
      headline: parsed.headline,
      stance: parsed.stance,
      focus: parsed.focus,
    };
  });
