import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import QRCode from "qrcode";
import type { WhatsAppState } from "./types";

type BaileysMod = typeof import("@whiskeysockets/baileys");

type Socket = Awaited<ReturnType<BaileysMod["default"]>>;

type Gateway = {
  state: WhatsAppState;
  sock: Socket | null;
  starting: Promise<void> | null;
};

const AUTH_DIR = join(process.cwd(), "data", "whatsapp-auth");

function emptyState(): WhatsAppState {
  return {
    status: "idle",
    qrDataUrl: null,
    pairingCode: null,
    me: null,
    error: null,
  };
}

function bag(): Gateway {
  const g = globalThis as typeof globalThis & { __meridianWA?: Gateway };
  if (!g.__meridianWA) {
    g.__meridianWA = { state: emptyState(), sock: null, starting: null };
  }
  return g.__meridianWA;
}

function jidToPhone(jid: string | undefined | null): string | null {
  if (!jid) return null;
  const user = jid.split("@")[0] ?? "";
  const num = user.split(":")[0] ?? "";
  return num || null;
}

export function getState(): WhatsAppState {
  return { ...bag().state };
}

export async function disconnectWhatsApp() {
  const g = bag();
  try {
    await g.sock?.end(undefined);
  } catch {
    /* ignore */
  }
  g.sock = null;
  g.starting = null;
  g.state = emptyState();
  g.state.status = "offline";
}

export async function sendText(text: string, to?: string): Promise<{ ok: boolean; error?: string }> {
  const g = bag();
  if (!g.sock || g.state.status !== "connected") {
    return { ok: false, error: "WhatsApp is not linked." };
  }
  const self = jidToPhone(g.sock.user?.id);
  const dest = (to ?? self ?? "").replace(/[^\d]/g, "");
  if (!dest) return { ok: false, error: "No destination number." };
  try {
    await g.sock.sendMessage(`${dest}@s.whatsapp.net`, { text });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Send failed." };
  }
}

export async function startWhatsAppLink(phone?: string) {
  const g = bag();
  if (g.state.status === "connected") return getState();
  if (g.starting) {
    await g.starting;
    return getState();
  }
  g.starting = connect(phone);
  try {
    await g.starting;
  } finally {
    g.starting = null;
  }
  return getState();
}

async function connect(phone?: string) {
  const g = bag();
  const baileys = await import("@whiskeysockets/baileys");
  const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    Browsers,
    DisconnectReason,
  } = baileys;

  await mkdir(AUTH_DIR, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  g.state = {
    ...emptyState(),
    status: "connecting",
  };

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: Browsers.macOS("Meridian"),
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });
  g.sock = sock;
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      try {
        g.state.qrDataUrl = await QRCode.toDataURL(qr, {
          margin: 1,
          width: 280,
          color: { dark: "#09090b", light: "#f4f4f5" },
        });
        g.state.status = "qr";
        g.state.error = null;
      } catch {
        g.state.error = "Could not draw QR.";
      }
    }
    if (connection === "open") {
      g.state.status = "connected";
      g.state.qrDataUrl = null;
      g.state.pairingCode = null;
      g.state.me = jidToPhone(sock.user?.id);
      g.state.error = null;
    }
    if (connection === "close") {
      const code = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)
        ?.output?.statusCode;
      g.sock = null;
      if (code === DisconnectReason.loggedOut) {
        g.state = emptyState();
        g.state.status = "offline";
        g.state.error = "WhatsApp logged out. Link again.";
        return;
      }
      g.state.status = "offline";
      g.state.error = "Disconnected. Retrying…";
      setTimeout(() => {
        void startWhatsAppLink(phone);
      }, 4000);
    }
  });

  if (phone) {
    const digits = phone.replace(/[^\d]/g, "");
    if (digits.length >= 8) {
      try {
        await new Promise((r) => setTimeout(r, 1200));
        const code = await sock.requestPairingCode(digits);
        g.state.pairingCode = code;
        g.state.status = "pairing";
        g.state.error = null;
      } catch (err) {
        g.state.error =
          err instanceof Error ? err.message : "Pairing code failed. Try the QR.";
      }
    }
  }
}
