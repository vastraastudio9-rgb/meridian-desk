import { Bot, List, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { INTERVALS, type Interval } from "@/lib/market/universe";
import { relativeAgo } from "@/lib/market/format";
import { cn } from "@/lib/utils";
import { Wordmark } from "./mark";

type HeaderProps = {
  interval: Interval;
  onInterval: (interval: Interval) => void;
  generatedAt?: number;
  now: number | null;
  scanning: boolean;
  onRefresh: () => void;
  onOpenWatch: () => void;
  onOpenAgents: () => void;
  autopilot: boolean;
  longs: number;
  shorts: number;
  waits: number;
  aligned: number;
  hitRate: number | null;
  closedTrades: number;
};

export function DeskHeader({
  interval,
  onInterval,
  generatedAt,
  now,
  scanning,
  onRefresh,
  onOpenWatch,
  onOpenAgents,
  autopilot,
  longs,
  shorts,
  waits,
  aligned,
  hitRate,
  closedTrades,
}: HeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center justify-between gap-3">
        <Wordmark />
        <div className="flex items-center gap-2 lg:hidden">
          <Button variant="outline" size="sm" onClick={onOpenAgents}>
            <Bot />
            Agents
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenWatch}>
            <List />
            Watch
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div
          role="tablist"
          aria-label="Timeframe"
          className="flex rounded-full border border-border bg-secondary p-1"
        >
          {INTERVALS.map((item) => {
            const active = item.id === interval;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onInterval(item.id)}
                className={cn(
                  "h-8 min-w-11 rounded-full px-3 text-xs font-medium tabular-nums transition-[background-color,color] duration-150",
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

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className={cn(
              "size-1.5 rounded-full bg-long",
              scanning || autopilot ? "live-dot" : "",
            )}
            aria-hidden="true"
          />
          <span className="tabular-nums">
            {scanning ? "Scanning" : autopilot ? "Live" : "Manual"}
            {generatedAt && now != null ? ` · ${relativeAgo(generatedAt, now)}` : ""}
          </span>
          <span className="text-subtle">·</span>
          <span className="tabular-nums">
            {longs} long · {shorts} short · {waits} wait · {aligned} aligned
          </span>
          {hitRate != null && (
            <>
              <span className="text-subtle">·</span>
              <span className="tabular-nums text-foreground">
                Hit {hitRate}%
                <span className="text-muted-foreground"> / {closedTrades}</span>
              </span>
            </>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className="max-lg:hidden"
            aria-label="Watchlist"
            onClick={onOpenWatch}
          >
            <List />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Refresh scan"
            onClick={onRefresh}
            disabled={scanning}
          >
            <RefreshCw className={cn(scanning && "animate-spin")} />
          </Button>
        </div>
      </div>
    </header>
  );
}
