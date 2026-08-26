import { createServerFn } from "@tanstack/react-start";

const TG = "https://api.telegram.org";

async function tg<T>(token: string, method: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${TG}/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12_000),
  });
  const json = (await res.json()) as { ok?: boolean; description?: string; result?: T };
  if (!json.ok) {
    throw new Error(json.description ?? `Telegram ${res.status}`);
  }
  return json.result as T;
}

export const sendTelegram = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (typeof input !== "object" || input === null) throw new Error("Invalid payload");
    const raw = input as { token?: unknown; chatId?: unknown; text?: unknown };
    const token = String(raw.token ?? "").trim();
    const chatId = String(raw.chatId ?? "").trim();
    const text = String(raw.text ?? "").slice(0, 3500);
    if (!text.trim()) throw new Error("Missing Telegram fields");
    return { token, chatId, text };
  })
  .handler(async ({ data }) => {
    let token = data.token;
    let chatId = data.chatId;
    if (!token || !chatId) {
      const { telegramCreds } = await import("@/lib/agents/runtime");
      const creds = await telegramCreds();
      token = token || creds.token;
      chatId = chatId || creds.chatId;
    }
    if (!token || !chatId) {
      return { ok: false as const, error: "Telegram is not linked." };
    }
    try {
      await tg(token, "sendMessage", {
        chat_id: chatId,
        text: data.text,
        disable_web_page_preview: true,
      });
      return { ok: true as const };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Telegram send failed.",
      };
    }
  });

export const discoverTelegramChat = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const token =
      typeof input === "object" && input !== null && "token" in input
        ? String((input as { token?: unknown }).token ?? "").trim()
        : "";
    if (!token) throw new Error("Missing bot token");
    return { token };
  })
  .handler(async ({ data }) => {
    try {
      const updates = await tg<
        { message?: { chat?: { id?: number; type?: string; first_name?: string } } }[]
      >(data.token, "getUpdates");
      const privates = updates
        .map((u) => u.message?.chat)
        .filter((c) => c && c.type === "private" && c.id != null);
      const last = privates[privates.length - 1];
      if (!last?.id) {
        return {
          ok: false as const,
          error: "No chat yet. Open your bot in Telegram and tap Start, then try again.",
        };
      }
      return { ok: true as const, chatId: String(last.id), name: last.first_name ?? "" };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Could not reach Telegram.",
      };
    }
  });

export async function telegramHostStatus() {
  return { linked: false, bot: "", chatId: "" };
}
