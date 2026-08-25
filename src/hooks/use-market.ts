import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { applyLiveQuotes } from "@/lib/market/live";
import { getLiveQuotes, getMarketSnapshot } from "@/lib/market/snapshot";
import type { MarketSnapshot } from "@/lib/market/types";
import type { Interval } from "@/lib/market/universe";

export function useMarket(interval: Interval, initial?: MarketSnapshot | null) {
  const seeded = initial && initial.interval === interval ? initial : undefined;
  const market = useQuery({
    queryKey: ["market", interval],
    queryFn: () => getMarketSnapshot({ data: { interval } }),
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
    placeholderData: (previous) => previous,
    initialData: seeded,
    initialDataUpdatedAt: seeded?.generatedAt,
  });

  const quotes = useQuery({
    queryKey: ["quotes"],
    queryFn: () => getLiveQuotes(),
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
    enabled: Boolean(market.data),
  });

  const data = useMemo(() => {
    if (!market.data) return undefined;
    if (!quotes.data?.quotes.length) return market.data;
    return applyLiveQuotes(market.data, quotes.data.quotes);
  }, [market.data, quotes.data]);

  return {
    ...market,
    data,
    isFetching: market.isFetching || quotes.isFetching,
  };
}
