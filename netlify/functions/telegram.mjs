const TG = "https://api.telegram.org";

function creds(body = {}) {
  const token = String(body.token || process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const chatId = String(body.chatId || process.env.TELEGRAM_CHAT_ID || "").trim();
  return { token, chatId };
}

async function tg(token, method, payload) {
  const res = await fetch(`${TG}/bot${token}/${method}`, {
    method: payload ? "POST" : "GET",
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  return res.json();
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  try {
    if (event.httpMethod === "GET") {
      const { token, chatId } = creds();
      let bot = "";
      if (token) {
        const me = await tg(token, "getMe");
        bot = me?.result?.username ?? "";
      }
      return json(200, {
        linked: Boolean(token && chatId),
        bot,
        chatId: chatId || "",
      });
    }

    if (event.httpMethod !== "POST") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const { token, chatId } = creds(body);
    const discover =
      body.discover === true ||
      new URLSearchParams(event.queryStringParameters || {}).has("discover");

    if (discover) {
      if (!token) return json(200, { ok: false, error: "Missing bot token" });
      const updates = await tg(token, "getUpdates");
      if (!updates.ok) {
        return json(200, { ok: false, error: updates.description ?? "Telegram error" });
      }
      const privates = (updates.result ?? [])
        .map((u) => u.message?.chat)
        .filter((c) => c && c.type === "private" && c.id != null);
      const last = privates[privates.length - 1];
      if (!last?.id) {
        return json(200, {
          ok: false,
          error: "No chat yet. Open your bot in Telegram and tap Start, then try again.",
        });
      }
      return json(200, { ok: true, chatId: String(last.id), name: last.first_name ?? "" });
    }

    const text = String(body.text ?? "").slice(0, 3500);
    if (!token || !chatId || !text.trim()) {
      return json(200, { ok: false, error: "Telegram is not linked on this host." });
    }
    const sent = await tg(token, "sendMessage", {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    });
    if (!sent.ok) {
      return json(200, { ok: false, error: sent.description ?? "Telegram send failed." });
    }
    return json(200, { ok: true });
  } catch (err) {
    return json(200, {
      ok: false,
      error: err instanceof Error ? err.message : "Telegram failed.",
    });
  }
}
