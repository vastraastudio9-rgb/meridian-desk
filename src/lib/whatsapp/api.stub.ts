const unavailable = {
  status: "offline" as const,
  qrDataUrl: null,
  pairingCode: null,
  me: null,
  error: "WhatsApp link needs the hosted Meridian desk.",
};

export const getWhatsAppStatus = async () => unavailable;
export const startWhatsApp = async () => unavailable;
export const logoutWhatsApp = async () => unavailable;
export const sendWhatsAppSignal = async () => ({
  ok: false as const,
  error: "WhatsApp is not available in the static pack.",
});
