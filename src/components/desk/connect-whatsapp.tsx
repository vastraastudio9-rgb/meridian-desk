import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getWhatsAppStatus,
  logoutWhatsApp,
  sendWhatsAppSignal,
  startWhatsApp,
} from "@/lib/whatsapp/api";
import type { WhatsAppState } from "@/lib/whatsapp/types";
import { cn } from "@/lib/utils";

const idle: WhatsAppState = {
  status: "idle",
  qrDataUrl: null,
  pairingCode: null,
  me: null,
  error: null,
};

export function ConnectWhatsApp({ enabled, className }: { enabled: boolean; className?: string }) {
  const [state, setState] = useState<WhatsAppState>(idle);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let on = true;
    async function tick() {
      try {
        const next = await getWhatsAppStatus();
        if (on) setState(next);
      } catch {
        if (on) setState({ ...idle, status: "offline", error: "Link service unreachable." });
      }
    }
    void tick();
    const id = window.setInterval(tick, 2500);
    return () => {
      on = false;
      window.clearInterval(id);
    };
  }, []);

  async function link() {
    setBusy(true);
    try {
      const next = await startWhatsApp({ data: { phone } });
      setState(next);
    } catch {
      setState({ ...idle, status: "offline", error: "Could not start WhatsApp link." });
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    try {
      setState(await logoutWhatsApp());
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      await sendWhatsAppSignal({
        data: { text: "MERIDIAN desk linked. You will receive calls here." },
      });
    } finally {
      setBusy(false);
    }
  }

  const linked = state.status === "connected";

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-label text-subtle">WhatsApp</p>
          <p className="mt-0.5 text-sm">
            {linked
              ? `Linked ${state.me ? `+${state.me}` : ""}`
              : state.status === "qr"
                ? "Scan the QR"
                : state.status === "pairing"
                  ? "Enter the code in WhatsApp"
                  : "Not linked"}
          </p>
        </div>
        {linked ? (
          <Button variant="outline" size="sm" onClick={unlink} disabled={busy}>
            Unlink
          </Button>
        ) : (
          <Button size="sm" onClick={link} disabled={busy}>
            {busy ? "Linking…" : "Link"}
          </Button>
        )}
      </div>

      {!linked && (
        <>
          <Input
            inputMode="tel"
            placeholder="Phone with country code"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-label="WhatsApp phone number"
          />
          <p className="text-xs leading-relaxed text-subtle">
            Open-source WhatsApp Web link (Baileys). Scan the QR with Linked
            devices, or enter your number for a pairing code. Unofficial — the
            session can drop.
          </p>
        </>
      )}

      {state.qrDataUrl && !linked && (
        <img
          src={state.qrDataUrl}
          alt="WhatsApp QR code"
          className="mx-auto aspect-square w-40 rounded-lg border border-border bg-foreground"
        />
      )}

      {state.pairingCode && !linked && (
        <p className="font-mono text-center text-lg tracking-label tabular-nums">
          {state.pairingCode}
        </p>
      )}

      {state.error && (
        <p className="text-xs text-short">{state.error}</p>
      )}

      {linked && (
        <Button variant="outline" size="sm" onClick={test} disabled={busy || !enabled}>
          Send test
        </Button>
      )}
    </div>
  );
}
