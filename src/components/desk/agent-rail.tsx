import { Bot, Download, Volume2, VolumeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AgentEvent, AnalystNote } from "@/lib/agents/types";
import type { DeskMode } from "@/lib/desk-store";
import { downloadDeskCsv } from "@/lib/export";
import { relativeAgo } from "@/lib/market/format";
import type { PaperFill } from "@/lib/market/types";
import { cn } from "@/lib/utils";
import { ConnectTelegram } from "./connect-telegram";
import { ConnectWhatsApp } from "./connect-whatsapp";
import { LiveKeys } from "./live-keys";
import { RiskPanel } from "./risk-panel";
import type { RiskParams } from "@/lib/risk/params";

const AGENT_LABEL = {
  scanner: "Scanner",
  risk: "Risk",
  analyst: "Analyst",
} as const;

export function AgentRail({
  autopilot,
  onAutopilot,
  analystStatus,
  analyst,
  events,
  fills,
  now,
  riskUsd,
  onRiskUsd,
  risk,
  onRisk,
  riskHalt,
  soundOn,
  onSound,
  whatsappOn,
  onWhatsapp,
  telegramOn,
  onTelegram,
  telegramToken,
  telegramChatId,
  onTelegramToken,
  onTelegramChatId,
  mode,
  onMode,
  binanceKey,
  binanceSecret,
  binanceTestnet,
  onBinanceKey,
  onBinanceSecret,
  onBinanceTestnet,
  serverOn,
  lastError,
  className,
}: {
  autopilot: boolean;
  onAutopilot: (on: boolean) => void;
  analystStatus: "idle" | "reading" | "live" | "offline";
  analyst: AnalystNote | null;
  events: AgentEvent[];
  fills: PaperFill[];
  now: number | null;
  riskUsd: number;
  onRiskUsd: (n: number) => void;
  risk: RiskParams;
  onRisk: (patch: Partial<RiskParams>) => void;
  riskHalt: string | null;
  soundOn: boolean;
  onSound: (on: boolean) => void;
  whatsappOn: boolean;
  onWhatsapp: (on: boolean) => void;
  telegramOn: boolean;
  onTelegram: (on: boolean) => void;
  telegramToken: string;
  telegramChatId: string;
  onTelegramToken: (v: string) => void;
  onTelegramChatId: (v: string) => void;
  mode: DeskMode;
  onMode: (mode: DeskMode) => void;
  binanceKey: string;
  binanceSecret: string;
  binanceTestnet: boolean;
  onBinanceKey: (v: string) => void;
  onBinanceSecret: (v: string) => void;
  onBinanceTestnet: (v: boolean) => void;
  serverOn?: boolean;
  lastError?: string | null;
  className?: string;
}) {
  return (
    <aside className={cn("flex min-h-0 flex-col bg-background", className)}>
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-label text-subtle">Desk</p>
          <h2 className="mt-1 text-sm font-medium">
            {serverOn ? "Autonomous" : "Agents"}
          </h2>
        </div>
        <Button
          variant={autopilot ? "default" : "outline"}
          size="sm"
          onClick={() => onAutopilot(!autopilot)}
          aria-pressed={autopilot}
        >
          <Bot />
          {autopilot ? "On" : "Off"}
        </Button>
      </div>

      <div className="border-b border-border px-4 py-3">
        <ConnectTelegram
          enabled={telegramOn}
          onEnabled={onTelegram}
          token={telegramToken}
          chatId={telegramChatId}
          onToken={onTelegramToken}
          onChatId={onTelegramChatId}
        />
      </div>

      <div className="border-b border-border px-4 py-3">
        <LiveKeys
          mode={mode}
          onMode={onMode}
          apiKey={binanceKey}
          apiSecret={binanceSecret}
          testnet={binanceTestnet}
          onKey={onBinanceKey}
          onSecret={onBinanceSecret}
          onTestnet={onBinanceTestnet}
        />
      </div>

      <div className="border-b border-border px-4 py-3">
        <ConnectWhatsApp enabled={whatsappOn} />
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">WhatsApp send</p>
          <Button
            variant={whatsappOn ? "default" : "outline"}
            size="sm"
            aria-pressed={whatsappOn}
            onClick={() => onWhatsapp(!whatsappOn)}
          >
            {whatsappOn ? "On" : "Off"}
          </Button>
        </div>
      </div>

      <div className="border-b border-border px-4 py-3">
        <RiskPanel params={risk} onChange={onRisk} halt={riskHalt} />
      </div>

      <ul className="space-y-2 px-4 py-3">
        <AgentStatus
          name="Scanner"
          detail={
            !autopilot
              ? "Paused"
              : serverOn
                ? "Loop on — no click needed"
                : "Reading Binance"
          }
          live={autopilot}
        />
        <AgentStatus
          name="Risk"
          detail={
            !autopilot
              ? "Paused"
              : riskHalt
                ? riskHalt
                : `Conf ${risk.confMin} · ${risk.atrStop} ATR · ${risk.rewardR}R`
          }
          live={autopilot && !riskHalt}
        />
        <AgentStatus
          name="Analyst"
          detail={
            !autopilot
              ? "Paused"
              : analystStatus === "reading"
                ? "Writing the tape"
                : analystStatus === "live"
                  ? "Grok on desk"
                  : analystStatus === "offline"
                    ? "Local rules"
                    : "Standing by"
          }
          live={autopilot && analystStatus !== "offline"}
        />
      </ul>
      {lastError && (
        <p className="px-4 pb-2 text-xs text-short">{lastError}</p>
      )}

      {analyst && (
        <div className="mx-4 mb-3 rounded-xl border border-border bg-card px-3 py-3">
          <p className="text-xs uppercase tracking-label text-subtle">
            {analyst.stance.replace("-", " ")}
          </p>
          <p className="mt-1 font-display text-xl italic leading-tight">
            {analyst.headline}
          </p>
          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
            {analyst.notes}
          </p>
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        <ol className="space-y-3 px-4 pb-4">
          {events.length === 0 && (
            <li className="text-xs text-muted-foreground">
              Autopilot will journal scans, risk gates, and analyst notes here.
            </li>
          )}
          {events.map((event) => (
            <li key={event.id} className="border-l border-border pl-3">
              <p className="text-xs uppercase tracking-label text-subtle">
                {AGENT_LABEL[event.agent]}
                <span className="mx-1.5 text-border-strong">·</span>
                <span className="font-mono tabular-nums normal-case tracking-normal">
                  {now == null ? "just now" : relativeAgo(event.at, now)}
                </span>
              </p>
              <p
                className={cn(
                  "mt-1 text-sm leading-snug",
                  event.tone === "long" && "text-long",
                  event.tone === "short" && "text-short",
                )}
              >
                {event.title}
              </p>
              <p className="mt-0.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                {event.detail}
              </p>
            </li>
          ))}
        </ol>
      </ScrollArea>

      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant={soundOn ? "secondary" : "outline"}
            size="icon-sm"
            aria-label={soundOn ? "Mute alerts" : "Enable sound"}
            onClick={() => onSound(!soundOn)}
          >
            {soundOn ? <Volume2 /> : <VolumeOff />}
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Export blotter"
            onClick={() => downloadDeskCsv(fills, events)}
          >
            <Download />
          </Button>
        </div>
      </div>
    </aside>
  );
}

function AgentStatus({
  name,
  detail,
  live,
}: {
  name: string;
  detail: string;
  live: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          live ? "bg-long live-dot" : "bg-wait",
        )}
        aria-hidden="true"
      />
    </li>
  );
}
