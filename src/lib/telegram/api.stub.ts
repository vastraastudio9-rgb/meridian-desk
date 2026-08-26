type Payload = { token?: string; chatId?: string; text?: string; discover?: boolean };

function unwrap(input: unknown): Payload {
  if (typeof input !== "object" || input === null) return {};
  const raw = input as Record<string, unknown>;
  if (raw.data && typeof raw.data === "object") return raw.data as Payload;
  return raw as Payload;
}

async function callFn(payload: Payload, query = "") {
  const res = await fetch(`/.netlify/functions/telegram${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function sendTelegram(input?: unknown) {
  try {
    const payload = unwrap(input);
    const json = await callFn({
      token: payload.token,
      chatId: payload.chatId,
      text: payload.text,
    });
    if (!json?.ok) {
      return { ok: false as const, error: String(json?.error ?? "Telegram send failed.") };
    }
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Telegram needs the hosted Meridian desk." };
  }
}

export async function discoverTelegramChat(input?: unknown) {
  try {
    const payload = unwrap(input);
    const json = await callFn({ token: payload.token, discover: true }, "?discover=1");
    if (!json?.ok) {
      return { ok: false as const, error: String(json?.error ?? "Could not reach Telegram.") };
    }
    return {
      ok: true as const,
      chatId: String(json.chatId ?? ""),
      name: String(json.name ?? ""),
    };
  } catch {
    return { ok: false as const, error: "Telegram needs the hosted Meridian desk." };
  }
}

export async function telegramHostStatus() {
  try {
    const res = await fetch("/.netlify/functions/telegram");
    const json = (await res.json()) as { linked?: boolean; bot?: string; chatId?: string };
    return {
      linked: Boolean(json.linked),
      bot: String(json.bot ?? ""),
      chatId: String(json.chatId ?? ""),
    };
  } catch {
    return { linked: false, bot: "", chatId: "" };
  }
}
