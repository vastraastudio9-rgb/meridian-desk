import { createHmac } from "node:crypto";

function roundQty(qty: number, price: number) {
  if (price >= 100) return Math.floor(qty * 1e5) / 1e5;
  if (price >= 1) return Math.floor(qty * 1e3) / 1e3;
  if (price >= 0.01) return Math.floor(qty * 10) / 10;
  return Math.floor(qty);
}

export async function submitSpotOrder(data: {
  apiKey: string;
  apiSecret: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  testnet: boolean;
}): Promise<
  | { ok: true; orderId: string; status: string; executedQty: string }
  | { ok: false; error: string }
> {
  const qty = roundQty(data.quantity, data.price || 1);
  if (qty <= 0) return { ok: false, error: "Quantity rounded to zero." };

  const base = data.testnet
    ? "https://testnet.binance.vision"
    : "https://api.binance.com";
  const timestamp = Date.now();
  const params = new URLSearchParams({
    symbol: data.symbol,
    side: data.side,
    type: "MARKET",
    quantity: String(qty),
    newOrderRespType: "RESULT",
    recvWindow: "5000",
    timestamp: String(timestamp),
  });
  const signature = createHmac("sha256", data.apiSecret)
    .update(params.toString())
    .digest("hex");
  params.set("signature", signature);

  try {
    const res = await fetch(`${base}/api/v3/order?${params.toString()}`, {
      method: "POST",
      headers: { "X-MBX-APIKEY": data.apiKey },
      signal: AbortSignal.timeout(12_000),
    });
    const json = (await res.json()) as {
      orderId?: number;
      status?: string;
      msg?: string;
      executedQty?: string;
    };
    if (!res.ok) {
      return { ok: false, error: json.msg ?? `Binance ${res.status}` };
    }
    return {
      ok: true,
      orderId: String(json.orderId ?? ""),
      status: json.status ?? "UNKNOWN",
      executedQty: json.executedQty ?? String(qty),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Order failed.",
    };
  }
}
