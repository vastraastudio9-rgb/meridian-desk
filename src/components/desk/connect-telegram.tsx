import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { discoverTelegramChat, sendTelegram } from "@/lib/telegram/api";
import { cn } from "@/lib/utils";

export function ConnectTelegram({
  enabled,
  onEnabled,
  token,
  chatId,
  onToken,
  onChatId,
  className,
}: {
  enabled: boolean;
  onEnabled: (on: boolean) => void;
  token: string;
  chatId: string;
  onToken: (token: string) => void;
  onChatId: (id: string) => void;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const linked = Boolean(token && chatId);

  async function findChat() {
    if (!token.trim()) {
      setNote("Paste the bot token from BotFather first.");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const result = await discoverTelegramChat({ data: { token: token.trim() } });
      if (result.ok) {
        onChatId(result.chatId);
        setNote(result.name ? `Linked ${result.name}` : `Chat ${result.chatId}`);
      } else {
        setNote(result.error);
      }
    } catch {
      setNote("Could not reach Telegram.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    if (!token || !chatId) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await sendTelegram({
        data: {
          token,
          chatId,
          text: "MERIDIAN desk linked. Paper and live calls will land here.",
        },
      });
      setNote(result.ok ? "Test sent." : result.error);
    } catch {
      setNote("Test failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-label text-subtle">Telegram</p>
          <p className="mt-0.5 text-sm">{linked ? "Ready" : "Not linked"}</p>
        </div>
        <Button
          variant={enabled ? "default" : "outline"}
          size="sm"
          aria-pressed={enabled}
          onClick={() => onEnabled(!enabled)}
        >
          {enabled ? "On" : "Off"}
        </Button>
      </div>
      <Input
        type="password"
        autoComplete="off"
        placeholder="Bot token from BotFather"
        value={token}
        onChange={(e) => onToken(e.target.value)}
        aria-label="Telegram bot token"
      />
      <Input
        placeholder="Chat ID"
        value={chatId}
        onChange={(e) => onChatId(e.target.value)}
        aria-label="Telegram chat id"
      />
      <p className="text-xs leading-relaxed text-subtle">
        Message @BotFather → New bot → paste the token. Open your bot, tap Start,
        then Find chat.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={findChat} disabled={busy}>
          Find chat
        </Button>
        <Button variant="outline" size="sm" onClick={test} disabled={busy || !linked}>
          Send test
        </Button>
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
