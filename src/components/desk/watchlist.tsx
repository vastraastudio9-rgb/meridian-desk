import { useMemo, useState } from "react";
import { Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { MarketRow, Side } from "@/lib/market/types";
import { UNIVERSE } from "@/lib/market/universe";
import { formatPct, formatPrice } from "@/lib/market/format";
import { cn } from "@/lib/utils";

const SIDE_DOT: Record<Side, string> = {
  long: "bg-long",
  short: "bg-short",
  wait: "bg-wait",
};

export function WatchlistPanel({
  markets,
  watchlist,
  selected,
  onSelect,
  onToggle,
  onAdd,
  className,
}: {
  markets: MarketRow[];
  watchlist: string[];
  selected: string | null;
  onSelect: (symbol: string) => void;
  onToggle: (symbol: string) => void;
  onAdd: (symbol: string) => void;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const bySymbol = useMemo(
    () => new Map(markets.map((m) => [m.symbol, m])),
    [markets],
  );
  const rows = watchlist
    .map((symbol) => bySymbol.get(symbol))
    .filter((row): row is MarketRow => Boolean(row));

  const available = UNIVERSE.filter((p) => {
    if (watchlist.includes(p.symbol)) return false;
    const hay = `${p.base} ${p.name}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  return (
    <aside className={cn("flex min-h-0 flex-col bg-background", className)}>
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <h2 className="text-sm font-medium">Watch</h2>
          <p className="text-xs text-muted-foreground">{rows.length} names</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon-sm" aria-label="Add pair">
              <Plus />
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search pairs"
              autoFocus
            />
            <div className="mt-2 max-h-56 overflow-y-auto">
              {available.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  No pairs left to add.
                </p>
              ) : (
                available.map((p) => (
                  <button
                    key={p.symbol}
                    type="button"
                    onClick={() => {
                      onAdd(p.symbol);
                      setQ("");
                    }}
                    className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-secondary"
                  >
                    <span>{p.base}</span>
                    <span className="text-xs text-muted-foreground">{p.name}</span>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ul className="px-2 pb-4">
          {rows.map((row) => {
            const active = row.symbol === selected;
            const up = row.changePct >= 0;
            return (
              <li key={row.symbol}>
                <button
                  type="button"
                  onClick={() => onSelect(row.symbol)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 text-left transition-colors duration-150",
                    active ? "bg-secondary" : "hover:bg-secondary/60",
                  )}
                >
                  <span
                    className={cn("size-1.5 rounded-full", SIDE_DOT[row.signal.side])}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{row.base}</span>
                    <span className="block font-mono text-xs tabular-nums text-muted-foreground">
                      {formatPrice(row.price)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "font-mono text-xs tabular-nums",
                      up ? "text-long" : "text-short",
                    )}
                  >
                    {formatPct(row.changePct)}
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle(row.symbol);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        onToggle(row.symbol);
                      }
                    }}
                    className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${row.base}`}
                  >
                    <Star className="size-3.5" fill="currentColor" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </aside>
  );
}
