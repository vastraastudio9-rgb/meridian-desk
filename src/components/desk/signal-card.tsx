import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { riskCheck } from "@/lib/agents/policy";
import { useDesk } from "@/lib/desk-store";
import type { MarketRow, Side } from "@/lib/market/types";
import { formatPct, formatPrice } from "@/lib/market/format";
import { formatQty } from "@/lib/market/size";
import { effectiveRiskUsd, planLevels, sizeForRisk } from "@/lib/risk/params";
import { cn } from "@/lib/utils";

const SIDE_LABEL: Record<Side, string> = {
  long: "Long",
  short: "Short",
  wait: "Wait",
};

export function SignalCard({
  row,
  active,
  watched,
  approved,
  onSelect,
  onToggleWatch,
}: {
  row: MarketRow;
  active: boolean;
  watched: boolean;
  approved: boolean;
  onSelect: () => void;
  onToggleWatch: () => void;
}) {
  const { signal } = row;
  const up = row.changePct >= 0;
  const risk = useDesk((s) => s.risk);
  const paperCash = useDesk((s) => s.paperCash);
  const levels = planLevels(row, risk);
  const riskUsd = effectiveRiskUsd(paperCash, risk);
  const { qty } = sizeForRisk(levels.entry, levels.stop, riskUsd, paperCash, risk.maxNotionalPct);
  const skip = !approved && signal.side !== "wait" ? riskCheck(row, risk) : null;

  return (
    <article
      className={cn(
        "group relative rounded-2xl border bg-card p-4 transition-[border-color,background-color] duration-150",
        active ? "border-border-strong bg-elevated" : "border-border hover:border-border-strong",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="absolute inset-0 rounded-2xl"
        aria-label={`${row.name} ${SIDE_LABEL[signal.side]} signal`}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant={signal.side}>{SIDE_LABEL[signal.side]}</Badge>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {signal.confidence}
            </span>
            {approved && (
              <span className="text-xs uppercase tracking-label text-long">
                Call
              </span>
            )}
            {row.alignState === "aligned" && (
              <span className="text-xs uppercase tracking-label text-muted-foreground">
                Align
              </span>
            )}
            {row.alignState === "pending" && (
              <span className="text-xs uppercase tracking-label text-subtle">
                HTF wait
              </span>
            )}
            {row.alignState === "against" && (
              <span className="text-xs uppercase tracking-label text-short">
                vs {row.higherInterval}
              </span>
            )}
          </div>
          <h3 className="mt-2 truncate font-medium leading-tight">
            {row.base}
            <span className="text-muted-foreground"> / USDT</span>
          </h3>
          <p className="mt-0.5 text-xs text-subtle">{row.name}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm tabular-nums">{formatPrice(row.price)}</p>
          <p
            className={cn(
              "font-mono text-xs tabular-nums",
              up ? "text-long" : "text-short",
            )}
          >
            {formatPct(row.changePct)}
          </p>
        </div>
      </div>

      <div className="relative mt-3 h-1 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full",
            signal.side === "long"
              ? "bg-long"
              : signal.side === "short"
                ? "bg-short"
                : "bg-wait",
          )}
          style={{ width: `${signal.confidence}%` }}
        />
      </div>

      <p className="relative mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {signal.reasons.join(" · ")}
      </p>
      <p className="relative mt-2 font-mono text-[11px] tabular-nums text-subtle">
        RSI {signal.rsi ?? "—"}
        <span className="mx-1.5 text-border-strong">·</span>
        EMA {signal.emaBias}
        <span className="mx-1.5 text-border-strong">·</span>
        MACD{" "}
        {signal.macdHist == null ? "—" : signal.macdHist > 0 ? "up" : "down"}
      </p>
      {skip && !skip.ok && (
        <p className="relative mt-2 text-[11px] leading-snug text-muted-foreground">
          Risk skip · {skip.reason}
        </p>
      )}

      <div className="relative mt-3 flex items-center justify-between gap-2 text-xs text-subtle">
        <span className="font-mono tabular-nums">
          Stop {formatPrice(levels.stop)}
          <span className="mx-1.5 text-border-strong">·</span>
          Tgt {formatPrice(levels.target)}
          {qty > 0 && (
            <>
              <span className="mx-1.5 text-border-strong">·</span>
              {formatQty(qty)}
            </>
          )}
        </span>
        <div className="relative z-10 flex items-center gap-2">
          {row.stats.winRate != null && (
            <span className="font-mono tabular-nums text-muted-foreground">
              {row.stats.winRate}% hit
            </span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleWatch();
            }}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
            aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
          >
            <Star
              className="size-3.5"
              fill={watched ? "currentColor" : "none"}
            />
          </button>
        </div>
      </div>
    </article>
  );
}
