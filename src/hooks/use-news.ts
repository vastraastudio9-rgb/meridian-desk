import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchTreeNews,
  newsForPair,
  newsForUniverse,
  type NewsItem,
} from "@/lib/news/tree";
import { PAIR_BY_SYMBOL, type Pair } from "@/lib/market/universe";

export function useNews() {
  return useQuery({
    queryKey: ["x-news"],
    queryFn: fetchTreeNews,
    refetchInterval: 50_000,
    refetchIntervalInBackground: true,
    staleTime: 20_000,
    retry: 1,
  });
}

export function useCoinNews(symbol: string | null) {
  const feed = useNews();
  const pair: Pair | undefined = symbol ? PAIR_BY_SYMBOL.get(symbol) : undefined;
  const items = useMemo(() => {
    if (!pair || !feed.data) return [] as NewsItem[];
    return newsForPair(feed.data, pair).slice(0, 8);
  }, [feed.data, pair]);
  return { ...feed, items, pair };
}

export function useTapeNews() {
  const feed = useNews();
  const rows = useMemo(
    () => (feed.data ? newsForUniverse(feed.data).slice(0, 24) : []),
    [feed.data],
  );
  return { ...feed, rows };
}
