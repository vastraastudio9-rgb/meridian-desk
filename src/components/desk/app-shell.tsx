import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAutopilot } from "@/hooks/use-autopilot";
import { useMarket } from "@/hooks/use-market";
import { useMedia } from "@/hooks/use-media";
import { useNow } from "@/hooks/use-now";
import { resetDeskPaper } from "@/lib/agents/runtime-api";
import { useDesk } from "@/lib/desk-store";
import type { MarketSnapshot } from "@/lib/market/types";
import { riskHalt } from "@/lib/risk/params";
import { AgentRail } from "./agent-rail";
import { BlotterBar, BlotterList } from "./blotter-bar";
import { CoinDetail } from "./coin-detail";
import { DeskHeader } from "./header";
import { NewsTape } from "./news-tape";
import { SignalFeed } from "./signal-feed";
import { TickerBar } from "./ticker";
import { WatchlistPanel } from "./watchlist";

export function AppShell({ initial }: { initial?: MarketSnapshot | null }) {
  const interval = useDesk((s) => s.interval);
  const filter = useDesk((s) => s.filter);
  const watchlist = useDesk((s) => s.watchlist);
  const selected = useDesk((s) => s.selected);
  const autopilot = useDesk((s) => s.autopilot);
  const events = useDesk((s) => s.events);
  const fills = useDesk((s) => s.fills);
  const analyst = useDesk((s) => s.analyst);
  const analystStatus = useDesk((s) => s.analystStatus);
  const riskUsd = useDesk((s) => s.riskUsd);
  const risk = useDesk((s) => s.risk);
  const setRisk = useDesk((s) => s.setRisk);
  const soundOn = useDesk((s) => s.soundOn);
  const whatsappOn = useDesk((s) => s.whatsappOn);
  const telegramOn = useDesk((s) => s.telegramOn);
  const telegramToken = useDesk((s) => s.telegramToken);
  const telegramChatId = useDesk((s) => s.telegramChatId);
  const mode = useDesk((s) => s.mode);
  const paperCash = useDesk((s) => s.paperCash);
  const binanceKey = useDesk((s) => s.binanceKey);
  const binanceSecret = useDesk((s) => s.binanceSecret);
  const binanceTestnet = useDesk((s) => s.binanceTestnet);
  const setInterval = useDesk((s) => s.setInterval);
  const setFilter = useDesk((s) => s.setFilter);
  const setSelected = useDesk((s) => s.setSelected);
  const setAutopilot = useDesk((s) => s.setAutopilot);
  const setRiskUsd = useDesk((s) => s.setRiskUsd);
  const setSoundOn = useDesk((s) => s.setSoundOn);
  const setWhatsappOn = useDesk((s) => s.setWhatsappOn);
  const setTelegramOn = useDesk((s) => s.setTelegramOn);
  const setTelegramToken = useDesk((s) => s.setTelegramToken);
  const setTelegramChatId = useDesk((s) => s.setTelegramChatId);
  const setMode = useDesk((s) => s.setMode);
  const setBinanceKey = useDesk((s) => s.setBinanceKey);
  const setBinanceSecret = useDesk((s) => s.setBinanceSecret);
  const setBinanceTestnet = useDesk((s) => s.setBinanceTestnet);
  const resetPaper = useDesk((s) => s.resetPaper);
  const toggleWatch = useDesk((s) => s.toggleWatch);
  const addWatch = useDesk((s) => s.addWatch);

  const market = useMarket(interval, initial);
  const now = useNow(1000);
  const isMd = useMedia("(min-width: 768px)");
  const isLg = useMedia("(min-width: 1024px)");
  const [watchOpen, setWatchOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [blotterOpen, setBlotterOpen] = useState(false);
  const manualUntil = useRef(0);

  const markets = market.data?.markets ?? [];

  const onFocus = useCallback(
    (symbol: string) => {
      if (Date.now() < manualUntil.current) return;
      setSelected(symbol);
    },
    [setSelected],
  );

  const { approved, serverOn, lastError, telegramLinked } = useAutopilot(market.data, onFocus);
  const approvedSet = useMemo(
    () => new Set(approved.map((row) => row.symbol)),
    [approved],
  );

  const filtered = useMemo(() => {
    return markets.filter((row) => {
      if (filter === "watch") return watchlist.includes(row.symbol);
      if (filter === "calls") return approvedSet.has(row.symbol);
      if (filter === "all") return true;
      return row.signal.side === filter;
    });
  }, [markets, filter, watchlist, approvedSet]);

  const selectedRow =
    markets.find((row) => row.symbol === selected) ??
    filtered[0] ??
    markets[0];

  const longs = markets.filter((row) => row.signal.side === "long").length;
  const shorts = markets.filter((row) => row.signal.side === "short").length;
  const waits = markets.filter((row) => row.signal.side === "wait").length;

  useEffect(() => {
    useDesk.getState().setHydrated(true);
    void Promise.resolve(useDesk.persist.rehydrate()).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (selected && markets.some((row) => row.symbol === selected)) return;
    const next = filtered[0]?.symbol ?? markets[0]?.symbol;
    if (next) setSelected(next);
  }, [selected, markets, filtered, setSelected]);

  function select(symbol: string) {
    manualUntil.current = Date.now() + 180_000;
    setSelected(symbol);
    if (!isMd) setDetailOpen(true);
  }

  function toggleAutopilot(on: boolean) {
    setAutopilot(on);
  }

  const watchProps = {
    markets,
    watchlist,
    selected: selectedRow?.symbol ?? null,
    onSelect: (symbol: string) => {
      select(symbol);
      setWatchOpen(false);
    },
    onToggle: toggleWatch,
    onAdd: addWatch,
  };

  const agentProps = {
    autopilot,
    onAutopilot: toggleAutopilot,
    analystStatus,
    analyst,
    events,
    fills,
    now,
    riskUsd,
    onRiskUsd: setRiskUsd,
    risk,
    onRisk: setRisk,
    riskHalt: riskHalt(fills, risk).ok ? null : riskHalt(fills, risk).reason,
    soundOn,
    onSound: setSoundOn,
    whatsappOn,
    onWhatsapp: setWhatsappOn,
    telegramOn,
    onTelegram: setTelegramOn,
    telegramToken,
    telegramChatId,
    onTelegramToken: setTelegramToken,
    onTelegramChatId: setTelegramChatId,
    telegramLinked,
    mode,
    onMode: setMode,
    binanceKey,
    binanceSecret,
    binanceTestnet,
    onBinanceKey: setBinanceKey,
    onBinanceSecret: setBinanceSecret,
    onBinanceTestnet: setBinanceTestnet,
    serverOn,
    lastError,
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <DeskHeader
        interval={interval}
        onInterval={setInterval}
        generatedAt={market.data?.quotedAt ?? market.data?.generatedAt}
        now={now}
        scanning={market.isLoading && !market.data}
        onRefresh={() => {
          void market.refetch();
        }}
        onOpenWatch={() => setWatchOpen(true)}
        onOpenAgents={() => setAgentOpen(true)}
        autopilot={autopilot}
        longs={longs}
        shorts={shorts}
        waits={waits}
        aligned={market.data?.breadth.aligned ?? 0}
        pending={market.data?.breadth.pending ?? 0}
        against={market.data?.breadth.against ?? 0}
        hitRate={market.data?.deskStats.winRate ?? null}
        closedTrades={market.data?.deskStats.closed ?? 0}
      />
      <TickerBar markets={markets} onSelect={select} />
      <NewsTape onSelect={select} />
      <BlotterBar
        fills={fills}
        markets={markets}
        cash={paperCash}
        mode={mode}
        onOpen={() => setBlotterOpen(true)}
      />

      {market.isError && !market.data && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2 text-sm">
          <p className="text-muted-foreground">
            Market feed is unreachable. The desk will retry on refresh.
          </p>
          <button
            type="button"
            className="text-sm font-medium underline-offset-4 hover:underline"
            onClick={() => {
              void market.refetch();
            }}
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:grid-cols-[280px_minmax(0,1fr)_minmax(320px,400px)]">
        <AgentRail
          {...agentProps}
          className="w-full border-r border-border max-lg:hidden"
        />
        <SignalFeed
          rows={filtered}
          selected={selectedRow?.symbol ?? null}
          watchlist={watchlist}
          approved={approvedSet}
          filter={filter}
          onFilter={setFilter}
          onSelect={select}
          onToggleWatch={toggleWatch}
          loading={market.isLoading && !market.data}
        />
        <CoinDetail
          row={selectedRow}
          snapshot={market.data}
          watched={selectedRow ? watchlist.includes(selectedRow.symbol) : false}
          onToggleWatch={() => {
            if (selectedRow) toggleWatch(selectedRow.symbol);
          }}
          className="w-full border-l border-border max-md:hidden"
        />
      </div>

      <Sheet open={agentOpen && !isLg} onOpenChange={setAgentOpen}>
        <SheetContent side="bottom" title="Agents" className="h-5/6">
          <AgentRail {...agentProps} className="h-full pt-8" />
        </SheetContent>
      </Sheet>

      <Sheet open={watchOpen} onOpenChange={setWatchOpen}>
        <SheetContent side="bottom" title="Watchlist" className="h-5/6">
          <WatchlistPanel {...watchProps} className="h-full pt-8" />
        </SheetContent>
      </Sheet>

      <Sheet open={blotterOpen} onOpenChange={setBlotterOpen}>
        <SheetContent side="bottom" title="Paper blotter" className="h-5/6">
          <div className="pt-8">
            <BlotterList
              fills={fills}
              markets={markets}
              cash={paperCash}
              onReset={() => {
                resetPaper();
                void resetDeskPaper().catch(() => undefined);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={detailOpen && !isMd} onOpenChange={setDetailOpen}>
        <SheetContent side="bottom" title="Pair detail" className="h-5/6">
          <CoinDetail
            row={selectedRow}
            snapshot={market.data}
            watched={selectedRow ? watchlist.includes(selectedRow.symbol) : false}
            onToggleWatch={() => {
              if (selectedRow) toggleWatch(selectedRow.symbol);
            }}
            className="h-full pt-8"
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
