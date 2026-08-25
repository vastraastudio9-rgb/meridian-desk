import { loadMarket, loadQuotes } from "./load-market";
import type { Interval } from "./universe";

export const getMarketSnapshot = async ({
  data,
}: {
  data: { interval: Interval };
}) => loadMarket(data.interval);

export const getLiveQuotes = async () => {
  const quotes = await loadQuotes();
  return { at: Date.now(), quotes };
};
