import { deskAccount } from "@/lib/market/account";
import { blotterStats } from "@/lib/market/blotter";
import { formatPrice, formatUsdMoney } from "@/lib/market/format";
import type { MarketRow, PaperFill } from "@/lib/market/types";
import { cn } from "@/lib/utils";

export function BlotterBar({
  fills,
  markets,
  cash,
  mode,
  onOpen,
}: {
  fills: PaperFill[];
  markets: MarketRow[];
  cash: number;
  mode: "paper" | "live";
  onOpen: () => void;
}) {
  const stats = blotterStats(fills);
  const acct = deskAccount(fills, markets, cash);
  const open = fills.filter((f) => f.result === "open").slice(0, 4);
  const rTone = acct.equity >= 10000 ? "long" : "short";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 overflow-hidden border-b border-border bg-secondary px-4 py-2.5 text-left sm:px-6"
    >
      <span className="shrink-0 text-xs uppercase tracking-label text-subtle">
        {mode === "live" ? "Live" : "Paper"}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        {open.length === 0
          ? "No open positions"
          : open.map((f) => `${f.base} ${f.side}`).join(" · ")}
      </span>
      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
        <span className={cn(rTone === "long" ? "text-foreground" : "text-short")}>
          {formatUsdMoney(acct.equity)}
        </span>
        <span className="mx-1.5 text-border-strong">·</span>
        {stats.wins}W {stats.losses}L
        <span className="mx-1.5 text-border-strong">·</span>
        <span
          className={cn(
            stats.r > 0 && "text-long",
            stats.r < 0 && "text-short",
          )}
        >
          {stats.r > 0 ? "+" : ""}
          {stats.r}R
        </span>
      </span>
    </button>
  );
}

export function BlotterList({
  fills,
  markets,
  cash,
  onReset,
}: {
  fills: PaperFill[];
  markets: MarketRow[];
  cash: number;
  onReset: () => void;
}) {
  const acct = deskAccount(fills, markets, cash);
  if (fills.length === 0) {
    return (
      <div className="px-1 py-8 text-center">
        <p className="font-mono text-lg tabular-nums">{formatUsdMoney(acct.equity)}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Autopilot books paper (or live) fills here when Risk clears a name.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-label text-subtle">Equity</p>
          <p className="mt-1 font-mono text-2xl tabular-nums">{formatUsdMoney(acct.equity)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cash {formatUsdMoney(acct.cash)} · open {formatUsdMoney(acct.unreal)} ·
            realized {formatUsdMoney(acct.realized)}
          </p>
        </div>
        <button
          type="button"
          className="text-xs underline-offset-4 hover:underline"
          onClick={onReset}
        >
          Reset paper
        </button>
      </div>
      <ol className="space-y-2">
        {fills.map((fill) => (
          <li
            key={fill.id}
            className="rounded-xl border border-border bg-card px-3 py-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm">
                {fill.base}
                <span className="text-muted-foreground"> / USDT</span>
              </p>
              <span
                className={cn(
                  "text-xs uppercase tracking-label",
                  fill.result === "win" && "text-long",
                  fill.result === "loss" && "text-short",
                  fill.result === "open" && "text-muted-foreground",
                )}
              >
                {fill.venue === "live" ? "live " : ""}
                {fill.result}
              </span>
            </div>
            <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
              {fill.side} · {fill.interval} · in {formatPrice(fill.entry)} · stop{" "}
              {formatPrice(fill.stop)} · tgt {formatPrice(fill.target)}
              {fill.pnlUsd != null
                ? ` · ${fill.pnlUsd >= 0 ? "+" : ""}$${fill.pnlUsd.toFixed(2)}`
                : ""}
            </p>
            {fill.liveError && (
              <p className="mt-1 text-xs text-short">{fill.liveError}</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
