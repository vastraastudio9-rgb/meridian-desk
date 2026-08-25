import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { requestBriefing } from "@/lib/ai/briefing";
import { getDeskRuntime, saveDeskConfig } from "@/lib/agents/runtime-api";
import {
  approvedCalls,
  formatCallMessage,
  formatCloseMessage,
  localAnalystCopy,
  scanLine,
  tapeFingerprint,
} from "@/lib/agents/policy";
import { useDesk } from "@/lib/desk-store";
import { placeBinanceSpot } from "@/lib/exchange/binance";
import { formatQty, positionSize } from "@/lib/market/size";
import type { MarketSnapshot } from "@/lib/market/types";
import { playCallTone } from "@/lib/sound";
import { sendTelegram } from "@/lib/telegram/api";
import { sendWhatsAppSignal } from "@/lib/whatsapp/api";

const BRIEF_EVERY_MS = 90_000;

export function useAutopilot(
  snapshot: MarketSnapshot | undefined,
  onFocus: (symbol: string) => void,
) {
  const hydrated = useDesk((s) => s.hydrated);
  const applyRuntime = useDesk((s) => s.applyRuntime);
  const autopilot = useDesk((s) => s.autopilot);
  const pushEvent = useDesk((s) => s.pushEvent);
  const addWatch = useDesk((s) => s.addWatch);
  const setAnalyst = useDesk((s) => s.setAnalyst);
  const setAnalystStatus = useDesk((s) => s.setAnalystStatus);
  const bookCall = useDesk((s) => s.bookCall);
  const markTape = useDesk((s) => s.markTape);
  const patchFill = useDesk((s) => s.patchFill);
  const soundOn = useDesk((s) => s.soundOn);
  const whatsappOn = useDesk((s) => s.whatsappOn);
  const telegramOn = useDesk((s) => s.telegramOn);
  const telegramToken = useDesk((s) => s.telegramToken);
  const telegramChatId = useDesk((s) => s.telegramChatId);
  const riskUsd = useDesk((s) => s.riskUsd);
  const risk = useDesk((s) => s.risk);
  const mode = useDesk((s) => s.mode);
  const interval = useDesk((s) => s.interval);
  const binanceKey = useDesk((s) => s.binanceKey);
  const binanceSecret = useDesk((s) => s.binanceSecret);
  const binanceTestnet = useDesk((s) => s.binanceTestnet);
  const lastScan = useRef<number>(0);
  const lastPrint = useRef<string>("");
  const lastKeys = useRef<Set<string>>(new Set());
  const lastBriefAt = useRef<number>(0);
  const lastBriefFp = useRef<string>("");
  const briefing = useRef(false);
  const lastAnalystFp = useRef<string>("");
  const seenEvents = useRef(new Set<string>());
  const primed = useRef(false);

  const runtime = useQuery({
    queryKey: ["desk-runtime"],
    queryFn: async () => {
      const result = await Promise.race([
        getDeskRuntime(),
        new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), 6_000);
        }),
      ]);
      return result;
    },
    refetchInterval: 8_000,
    refetchIntervalInBackground: true,
    staleTime: 2_000,
    retry: false,
    enabled: hydrated,
  });
  const serverFresh = Boolean(
    runtime.data &&
      runtime.data.running &&
      runtime.data.lastTickAt > 0 &&
      Date.now() - runtime.data.lastTickAt < 30_000,
  );

  const approved = useMemo(
    () => (snapshot ? approvedCalls(snapshot.markets, risk) : []),
    [risk, snapshot],
  );

  useEffect(() => {
    if (!hydrated) return;
    const handle = window.setTimeout(() => {
      void saveDeskConfig({
        data: {
          interval,
          riskUsd,
          risk,
          autopilot,
          mode,
          telegramOn,
          telegramToken,
          telegramChatId,
          binanceKey,
          binanceSecret,
          binanceTestnet,
        },
      }).catch(() => undefined);
    }, 500);
    return () => window.clearTimeout(handle);
  }, [
    hydrated,
    interval,
    riskUsd,
    risk,
    autopilot,
    mode,
    telegramOn,
    telegramToken,
    telegramChatId,
    binanceKey,
    binanceSecret,
    binanceTestnet,
  ]);

  useEffect(() => {
    if (!runtime.data?.running) return;
    if (!runtime.data.lastTickAt) return;
    applyRuntime({
      paperCash: runtime.data.paperCash,
      fills: runtime.data.fills,
      events: runtime.data.events,
      analyst: runtime.data.analyst,
      analystStatus: runtime.data.analystStatus,
    });
  }, [applyRuntime, runtime.data]);

  useEffect(() => {
    const events = runtime.data?.events;
    if (!events) return;
    for (const event of [...events].reverse()) {
      if (seenEvents.current.has(event.id)) continue;
      seenEvents.current.add(event.id);
      if (!primed.current) continue;
      if (event.agent === "risk" && event.title.startsWith("Approved")) {
        if (soundOn) playCallTone();
        toast(event.title, { description: event.detail });
        if (event.symbol) {
          addWatch(event.symbol);
          onFocus(event.symbol);
        }
      }
    }
    primed.current = true;
  }, [addWatch, onFocus, runtime.data?.events, soundOn]);

  function ping(text: string) {
    if (telegramOn && telegramToken && telegramChatId) {
      void sendTelegram({
        data: { token: telegramToken, chatId: telegramChatId, text },
      }).catch(() => undefined);
    }
    if (whatsappOn) {
      void sendWhatsAppSignal({ data: { text } }).catch(() => undefined);
    }
  }

  useEffect(() => {
    if (!hydrated || !snapshot) return;
    const closed = markTape(snapshot.markets);
    for (const fill of closed) {
      ping(formatCloseMessage(fill));
      pushEvent({
        at: Date.now(),
        agent: "risk",
        title: `Closed ${fill.base} ${fill.result}`,
        detail: `${fill.r ?? 0}R · ${fill.pnlUsd != null ? `$${fill.pnlUsd.toFixed(2)}` : ""}`,
        tone: fill.result === "win" ? "long" : "short",
        symbol: fill.symbol,
      });
    }
  }, [hydrated, markTape, pushEvent, snapshot, telegramChatId, telegramOn, telegramToken, whatsappOn]);

  useEffect(() => {
    if (!hydrated || !autopilot || !snapshot) return;

    const scanChanged = snapshot.generatedAt !== lastScan.current;
    if (scanChanged) {
      lastScan.current = snapshot.generatedAt;
      const scan = scanLine(snapshot);
      pushEvent({
        at: snapshot.generatedAt,
        agent: "scanner",
        title: scan.title,
        detail: scan.detail,
        tone: "neutral",
      });
    }

    const fp = tapeFingerprint(approved);
    const openSym = new Set(
      useDesk.getState().fills.filter((f) => f.result === "open").map((f) => f.symbol),
    );
    const fresh = approved.filter((r) => {
      const key = `${r.symbol}:${r.signal.side}`;
      if (openSym.has(r.symbol)) {
        lastKeys.current.add(key);
        return false;
      }
      return !lastKeys.current.has(key);
    });

    if (fp !== lastPrint.current) {
      lastPrint.current = fp;
      if (approved.length === 0) {
        if (scanChanged) {
          pushEvent({
            at: Date.now(),
            agent: "risk",
            title: "No calls cleared",
            detail: "Confidence, higher TF, or chop gate.",
            tone: "wait",
          });
        }
      } else {
        const lead = approved[0]!;
        pushEvent({
          at: Date.now(),
          agent: "risk",
          title: `Approved ${lead.base} ${lead.signal.side}`,
          detail: approved
            .slice(0, 4)
            .map((r) => `${r.base} ${r.signal.side} ${r.signal.confidence}`)
            .join(" · "),
          tone: lead.signal.side === "short" ? "short" : "long",
          symbol: lead.symbol,
        });
        addWatch(lead.symbol);
        onFocus(lead.symbol);
      }
    }

    for (const row of fresh) {
      const fill = bookCall(row, snapshot.interval);
      if (!fill) continue;
      lastKeys.current.add(`${row.symbol}:${row.signal.side}`);
      const { qty } = positionSize(row.signal.entry, row.signal.stop, riskUsd);
      if (soundOn) playCallTone();
      toast(`${row.base} ${row.signal.side}`, {
        description: `${mode} · ${formatQty(qty)} ${row.base} · $${riskUsd} risk`,
      });
      ping(formatCallMessage(row, snapshot.interval, fill.qty, fill.riskUsd, mode));

      if (mode === "live" && row.signal.side === "long" && binanceKey && binanceSecret) {
        void placeBinanceSpot({
          data: {
            apiKey: binanceKey,
            apiSecret: binanceSecret,
            symbol: row.symbol,
            side: "BUY",
            quantity: fill.qty,
            price: row.price,
            testnet: binanceTestnet,
          },
        }).then((result) => {
          if (result.ok) {
            patchFill(fill.id, { liveOrderId: result.orderId, venue: "live" });
          } else {
            patchFill(fill.id, { liveError: result.error, venue: "paper" });
          }
        });
      } else if (mode === "live" && row.signal.side === "short") {
        patchFill(fill.id, {
          liveError: "Spot live does not short. Booked as paper.",
          venue: "paper",
        });
      }
    }

    const copy = localAnalystCopy(approved);
    const analystFp = `${copy.headline}|${copy.stance}|${copy.notes}`;
    if (analystFp !== lastAnalystFp.current) {
      lastAnalystFp.current = analystFp;
      setAnalyst({
        at: snapshot.generatedAt,
        headline: copy.headline,
        notes: copy.notes,
        stance: copy.stance,
        focus: copy.focus,
      });
    }

    if (!snapshot.aiAvailable) {
      setAnalystStatus("offline");
      return;
    }

    const due =
      fp !== lastBriefFp.current &&
      Date.now() - lastBriefAt.current >= BRIEF_EVERY_MS &&
      !briefing.current;

    if (!due) return;

    const rows = (approved.length > 0 ? approved : snapshot.markets)
      .slice(0, 8)
      .map((m) => ({
        base: m.base,
        side: m.signal.side,
        confidence: m.signal.confidence,
        price: m.price,
        changePct: m.changePct,
        reasons: m.signal.reasons,
        rsi: m.signal.rsi,
      }));

    briefing.current = true;
    lastBriefFp.current = fp;
    lastBriefAt.current = Date.now();
    setAnalystStatus("reading");

    void requestBriefing({ data: { interval: snapshot.interval, rows } })
      .then((result) => {
        if (result.ok) {
          setAnalystStatus("live");
          setAnalyst({
            at: Date.now(),
            headline: result.headline,
            notes: result.text,
            stance: result.stance,
            focus: result.focus,
          });
          pushEvent({
            at: Date.now(),
            agent: "analyst",
            title: result.headline,
            detail: result.text,
            tone:
              result.stance === "risk-on"
                ? "long"
                : result.stance === "risk-off"
                  ? "short"
                  : "neutral",
          });
        } else {
          setAnalystStatus("offline");
        }
      })
      .catch(() => {
        setAnalystStatus("offline");
      })
      .finally(() => {
        briefing.current = false;
      });
  }, [
    addWatch,
    approved,
    autopilot,
    binanceKey,
    binanceSecret,
    binanceTestnet,
    bookCall,
    hydrated,
    mode,
    onFocus,
    patchFill,
    pushEvent,
    riskUsd,
    setAnalyst,
    setAnalystStatus,
    snapshot,
    soundOn,
    telegramChatId,
    telegramOn,
    telegramToken,
    whatsappOn,
  ]);

  return {
    approved,
    serverOn: serverFresh,
    lastError: runtime.data?.lastError ?? null,
    telegramLinked: Boolean(runtime.data?.telegramLinked),
  };
}
