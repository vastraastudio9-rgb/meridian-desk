import type { MarketRow } from "@/lib/market/types";
import type { SignalFilter } from "@/lib/desk-store";
import { cn } from "@/lib/utils";
import { SignalCard } from "./signal-card";
import { Skeleton } from "@/components/ui/skeleton";

const FILTERS: { id: SignalFilter; label: string }[] = [
  { id: "calls", label: "Calls" },
  { id: "all", label: "All" },
  { id: "long", label: "Long" },
  { id: "short", label: "Short" },
  { id: "wait", label: "Wait" },
  { id: "watch", label: "Watch" },
];

export function SignalFeed({
  rows,
  selected,
  watchlist,
  approved,
  filter,
  onFilter,
  onSelect,
  onToggleWatch,
  loading,
}: {
  rows: MarketRow[];
  selected: string | null;
  watchlist: string[];
  approved: Set<string>;
  filter: SignalFilter;
  onFilter: (filter: SignalFilter) => void;
  onSelect: (symbol: string) => void;
  onToggleWatch: (symbol: string) => void;
  loading: boolean;
}) {
  return (
    <section className="flex min-h-0 min-w-0 flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-medium">Scan</h2>
          <p className="text-xs text-muted-foreground">
            {filter === "calls"
              ? `${rows.length} call${rows.length === 1 ? "" : "s"} cleared by risk`
              : `${rows.length} pair${rows.length === 1 ? "" : "s"} on this pass`}
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Signal filter"
          className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-secondary p-1"
        >
          {FILTERS.map((item) => {
            const active = item.id === filter;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onFilter(item.id)}
                className={cn(
                  "h-8 shrink-0 rounded-full px-3 text-xs font-medium transition-[background-color,color] duration-150",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-5">
        {loading && rows.length === 0 ? (
          <div className="grid gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
            <p className="font-display text-2xl italic">Quiet tape</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {filter === "calls"
                ? "Risk has not cleared a call on this pass."
                : "Nothing matches this filter on the current scan."}
            </p>
          </div>
        ) : (
          <div className="stagger-in grid gap-3">
            {rows.map((row) => (
              <SignalCard
                key={row.symbol}
                row={row}
                active={row.symbol === selected}
                watched={watchlist.includes(row.symbol)}
                approved={approved.has(row.symbol)}
                onSelect={() => onSelect(row.symbol)}
                onToggleWatch={() => onToggleWatch(row.symbol)}
              />
            ))}
          </div>
        )}
        <p className="mt-6 text-center text-xs leading-relaxed text-subtle">
          Hit rate is paper: target before stop on recent candles. Not financial
          advice.
        </p>
      </div>
    </section>
  );
}
