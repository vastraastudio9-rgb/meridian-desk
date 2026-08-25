export type WhatsAppState = {
  status: "idle" | "connecting" | "qr" | "pairing" | "connected" | "offline";
  qrDataUrl: string | null;
  pairingCode: string | null;
  me: string | null;
  error: string | null;
};
