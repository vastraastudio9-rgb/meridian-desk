import type { MarketRow } from "@/lib/market/types";
import { formatPct, formatPrice } from "@/lib/market/format";
import { cn } from "@/lib/utils";

export function TickerBar({
  markets,
  onSelect,
}: {
  markets: MarketRow[];
  onSelect: (symbol: string) => void;
}) {
  if (markets.length === 0) {
    return <div className="h-10 border-b border-border bg-card" />;
  }

  const items = [...markets].sort((a, b) => b.quoteVolume - a.quoteVolume);
  const loop = [...items, ...items];

  return (
    <div className="relative h-10 overflow-hidden border-b border-border bg-card">
      <div className="ticker-track">
        {loop.map((row, i) => {
          const up = row.changePct >= 0;
          return (
            <button
              key={`${row.symbol}-${i}`}
              type="button"
              onClick={() => onSelect(row.symbol)}
              className="flex h-10 shrink-0 items-center gap-2 border-r border-border px-4 text-xs whitespace-nowrap"
            >
              <span className="font-medium tracking-wide">{row.base}</span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {formatPrice(row.price)}
              </span>
              <span
                className={cn(
                  "font-mono tabular-nums",
                  up ? "text-long" : "text-short",
                )}
              >
                {formatPct(row.changePct)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
