import { useState } from "react";
import { ScanText, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { requestBriefing } from "@/lib/ai/briefing";
import { riskCheck } from "@/lib/agents/policy";
import { useDesk } from "@/lib/desk-store";
import type { MarketRow, MarketSnapshot, Side } from "@/lib/market/types";
import { formatPct, formatPrice, formatUsdCompact } from "@/lib/market/format";
import { formatQty } from "@/lib/market/size";
import { effectiveRiskUsd, planLevels, sizeForRisk } from "@/lib/risk/params";
import { cn } from "@/lib/utils";
import { PriceChart } from "./price-chart";

const SIDE_LABEL: Record<Side, string> = {
  long: "Long",
  short: "Short",
  wait: "Wait",
};

function Stat({ label, value, tone }: { label: string; value: string; tone?: "long" | "short" | "muted" }) {
  return (
    <div className="rounded-xl bg-secondary px-3 py-2.5">
      <p className="text-xs uppercase tracking-label text-subtle">{label}</p>
      <p
        className={cn(
          "mt-1 font-mono text-sm tabular-nums",
          tone === "long" && "text-long",
          tone === "short" && "text-short",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function CoinDetail({
  row,
  snapshot,
  watched,
  onToggleWatch,
  className,
}: {
  row: MarketRow | undefined;
  snapshot: MarketSnapshot | undefined;
  watched: boolean;
  onToggleWatch: () => void;
  className?: string;
}) {
  const [brief, setBrief] = useState<string | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [briefKey, setBriefKey] = useState<string>("");
  const analyst = useDesk((s) => s.analyst);
  const autopilot = useDesk((s) => s.autopilot);
  const risk = useDesk((s) => s.risk);
  const paperCash = useDesk((s) => s.paperCash);

  if (!row) {
    return (
      <aside className={cn("flex min-h-0 flex-col bg-card px-5 py-16 text-center", className)}>
        <p className="font-display text-2xl italic">Select a pair</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Open a signal to see levels, indicators, and the chart.
        </p>
      </aside>
    );
  }

  const up = row.changePct >= 0;
  const { signal } = row;
  const scanKey = `${snapshot?.generatedAt ?? 0}:${snapshot?.interval ?? ""}`;
  const levels = planLevels(row, risk);
  const riskUsd = effectiveRiskUsd(paperCash, risk);
  const sized = sizeForRisk(levels.entry, levels.stop, riskUsd, paperCash, risk.maxNotionalPct);
  const skip = signal.side !== "wait" ? riskCheck(row, risk) : null;

  async function onBrief() {
    if (!snapshot) return;
    setPending(true);
    setBriefError(null);
    try {
      const actionable = snapshot.markets.filter((m) => m.signal.side !== "wait").slice(0, 8);
      const payload = (actionable.length > 0 ? actionable : snapshot.markets.slice(0, 8)).map(
        (m) => ({
          base: m.base,
          side: m.signal.side,
          confidence: m.signal.confidence,
          price: m.price,
          changePct: m.changePct,
          reasons: m.signal.reasons,
          rsi: m.signal.rsi,
        }),
      );
      const result = await requestBriefing({
        data: { interval: snapshot.interval, rows: payload },
      });
      if (result.ok) {
        setBrief(result.text);
        setBriefKey(scanKey);
      } else {
        setBriefError(result.error);
      }
    } catch {
      setBriefError("Could not reach the desk analyst.");
    } finally {
      setPending(false);
    }
  }

  const shownBrief = briefKey === scanKey ? brief : analyst?.notes ?? null;

  return (
    <aside className={cn("flex min-h-0 flex-col bg-card", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-label text-subtle">
              {row.name}
            </p>
            <h2 className="mt-1 font-display text-3xl italic leading-none">
              {row.base}
              <span className="text-muted-foreground"> / USDT</span>
            </h2>
          </div>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={onToggleWatch}
            aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
          >
            <Star fill={watched ? "currentColor" : "none"} />
          </Button>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <p className="font-mono text-3xl tabular-nums leading-none">
            {formatPrice(row.price)}
          </p>
          <p
            className={cn(
              "font-mono text-sm tabular-nums",
              up ? "text-long" : "text-short",
            )}
          >
            {formatPct(row.changePct)}
          </p>
        </div>

        <div className="mt-5">
          <PriceChart candles={row.candles} />
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Badge variant={signal.side}>{SIDE_LABEL[signal.side]}</Badge>
          <span className="text-xs text-muted-foreground">
            Confidence {signal.confidence}
          </span>
        </div>
        {skip && !skip.ok && (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Risk skip · {skip.reason}
          </p>
        )}
        {skip?.ok && (
          <p className="mt-2 text-xs leading-relaxed text-long">Call · {skip.reason}</p>
        )}
        <ul className="mt-3 space-y-1.5">
          {signal.reasons.map((reason) => (
            <li key={reason} className="text-sm leading-relaxed text-muted-foreground">
              {reason}
            </li>
          ))}
        </ul>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Stat label="Entry" value={formatPrice(levels.entry)} />
          <Stat
            label="Stop"
            value={formatPrice(levels.stop)}
            tone="short"
          />
          <Stat
            label="Target"
            value={formatPrice(levels.target)}
            tone="long"
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Stat
            label={`Size @ $${Math.round(riskUsd)}`}
            value={`${formatQty(sized.qty)} ${row.base}`}
          />
          <Stat
            label={row.higherInterval ? `${row.higherInterval} bias` : "Higher TF"}
            value={
              !row.higherInterval
                ? "—"
                : row.aligned
                  ? "Aligned"
                  : row.higherSide
                    ? row.higherSide
                    : "Wait"
            }
            tone={row.aligned ? "long" : "muted"}
          />
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <Stat
            label="RSI 14"
            value={signal.rsi == null ? "—" : signal.rsi.toFixed(1)}
            tone={
              signal.rsi != null && signal.rsi < 35
                ? "long"
                : signal.rsi != null && signal.rsi > 65
                  ? "short"
                  : "muted"
            }
          />
          <Stat
            label="EMA bias"
            value={
              signal.emaBias === "bull"
                ? "Bullish"
                : signal.emaBias === "bear"
                  ? "Bearish"
                  : "Flat"
            }
            tone={
              signal.emaBias === "bull"
                ? "long"
                : signal.emaBias === "bear"
                  ? "short"
                  : "muted"
            }
          />
          <Stat
            label="Volume"
            value={
              signal.volumeRatio == null ? "—" : `${signal.volumeRatio.toFixed(1)}×`
            }
          />
          <Stat label="24h volume" value={formatUsdCompact(row.quoteVolume)} />
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2">
          <Stat
            label="Hit rate"
            value={row.stats.winRate == null ? "—" : `${row.stats.winRate}%`}
            tone={
              row.stats.winRate == null
                ? "muted"
                : row.stats.winRate >= 50
                  ? "long"
                  : "short"
            }
          />
          <Stat label="Wins" value={String(row.stats.wins)} tone="long" />
          <Stat label="Losses" value={String(row.stats.losses)} tone="short" />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-subtle">
          Paper record on this timeframe: target hit before stop (1.85R vs 1R).
          Same-bar both-hit counts as a loss. {row.stats.closed} closed
          {row.stats.open ? ` · ${row.stats.open} still open` : ""}
          {row.stats.expectancyR != null
            ? ` · expectancy ${row.stats.expectancyR > 0 ? "+" : ""}${row.stats.expectancyR}R`
            : ""}
          . Not fills, not a promise.
        </p>

        <Separator className="my-5" />

        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">
              {autopilot ? "Analyst" : "Desk brief"}
            </h3>
            {snapshot?.aiAvailable && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBrief}
                disabled={pending}
              >
                <ScanText />
                {pending ? "Reading tape…" : shownBrief ? "Refresh" : "Ask Grok"}
              </Button>
            )}
          </div>
          {analyst?.headline && autopilot && (
            <p className="mt-2 font-display text-xl italic">{analyst.headline}</p>
          )}
          {!snapshot?.aiAvailable && !shownBrief && (
            <p className="mt-2 text-sm text-muted-foreground">
              Analyst is using local rules in this environment.
            </p>
          )}
          {pending && (
            <p className="mt-3 text-sm text-muted-foreground">Composing a desk note…</p>
          )}
          {briefError && (
            <p className="mt-3 text-sm text-short">{briefError}</p>
          )}
          {shownBrief && (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {shownBrief}
            </p>
          )}
          {autopilot && !shownBrief && !pending && (
            <p className="mt-2 text-sm text-muted-foreground">
              Analyst writes on its own when the tape changes.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
