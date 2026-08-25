import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DeskMode } from "@/lib/desk-store";
import { cn } from "@/lib/utils";

export function LiveKeys({
  mode,
  onMode,
  apiKey,
  apiSecret,
  testnet,
  onKey,
  onSecret,
  onTestnet,
  className,
}: {
  mode: DeskMode;
  onMode: (mode: DeskMode) => void;
  apiKey: string;
  apiSecret: string;
  testnet: boolean;
  onKey: (v: string) => void;
  onSecret: (v: string) => void;
  onTestnet: (v: boolean) => void;
  className?: string;
}) {
  const [confirm, setConfirm] = useState("");
  const armed = mode === "live";

  function arm() {
    if (confirm.trim().toUpperCase() !== "LIVE") return;
    if (!apiKey.trim() || !apiSecret.trim()) return;
    onMode("live");
    setConfirm("");
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-label text-subtle">Account</p>
          <p className="mt-0.5 text-sm">{armed ? "Live Binance" : "Paper $10k"}</p>
        </div>
        {armed ? (
          <Button variant="outline" size="sm" onClick={() => onMode("paper")}>
            Paper
          </Button>
        ) : (
          <Button size="sm" onClick={arm} disabled={confirm.trim().toUpperCase() !== "LIVE"}>
            Arm live
          </Button>
        )}
      </div>
      <Input
        type="password"
        autoComplete="off"
        placeholder="Binance API key"
        value={apiKey}
        onChange={(e) => onKey(e.target.value)}
        aria-label="Binance API key"
      />
      <Input
        type="password"
        autoComplete="off"
        placeholder="Binance API secret"
        value={apiSecret}
        onChange={(e) => onSecret(e.target.value)}
        aria-label="Binance API secret"
      />
      {!armed && (
        <Input
          placeholder='Type LIVE to arm'
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-label="Confirm live trading"
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {testnet ? "Binance testnet" : "Binance live spot"}
        </p>
        <Button
          variant={testnet ? "secondary" : "outline"}
          size="sm"
          onClick={() => onTestnet(!testnet)}
        >
          {testnet ? "Testnet" : "Real"}
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-subtle">
        Live is spot MARKET only. Longs buy; shorts stay paper (spot cannot
        freely short). Default stays paper. The desk has no proven edge.
      </p>
    </div>
  );
}
