import { createServerFn } from "@tanstack/react-start";

export const placeBinanceSpot = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (typeof input !== "object" || input === null) throw new Error("Invalid order");
    const raw = input as Record<string, unknown>;
    const apiKey = String(raw.apiKey ?? "").trim();
    const apiSecret = String(raw.apiSecret ?? "").trim();
    const symbol = String(raw.symbol ?? "").toUpperCase();
    const side = String(raw.side ?? "").toUpperCase();
    const quantity = Number(raw.quantity);
    const price = Number(raw.price);
    const testnet = Boolean(raw.testnet);
    if (!apiKey || !apiSecret) throw new Error("Missing API keys");
    if (!/^[A-Z0-9]+$/.test(symbol)) throw new Error("Bad symbol");
    if (side !== "BUY" && side !== "SELL") throw new Error("Bad side");
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Bad quantity");
    return {
      apiKey,
      apiSecret,
      symbol,
      side: side as "BUY" | "SELL",
      quantity,
      price,
      testnet,
    };
  })
  .handler(async ({ data }) => {
    const { submitSpotOrder } = await import("./spot");
    return submitSpotOrder(data);
  });
