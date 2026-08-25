import { createServerFn } from "@tanstack/react-start";

export const getWhatsAppStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getState } = await import("./gateway");
    return getState();
  },
);

export const startWhatsApp = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const phone =
      typeof input === "object" && input !== null && "phone" in input
        ? String((input as { phone?: unknown }).phone ?? "")
        : "";
    return { phone: phone.replace(/[^\d]/g, "").slice(0, 16) };
  })
  .handler(async ({ data }) => {
    const { startWhatsAppLink } = await import("./gateway");
    return startWhatsAppLink(data.phone || undefined);
  });

export const logoutWhatsApp = createServerFn({ method: "POST" }).handler(
  async () => {
    const { disconnectWhatsApp, getState } = await import("./gateway");
    await disconnectWhatsApp();
    return getState();
  },
);

export const sendWhatsAppSignal = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (typeof input !== "object" || input === null) {
      throw new Error("Invalid payload");
    }
    const raw = input as { text?: unknown; to?: unknown };
    const text = String(raw.text ?? "").slice(0, 900);
    if (!text.trim()) throw new Error("Empty message");
    return { text, to: raw.to ? String(raw.to).replace(/[^\d]/g, "") : "" };
  })
  .handler(async ({ data }) => {
    const { sendText } = await import("./gateway");
    return sendText(data.text, data.to || undefined);
  });
