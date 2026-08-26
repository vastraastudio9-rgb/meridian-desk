import { useNow } from "@/hooks/use-now";
import { useCoinNews } from "@/hooks/use-news";
import { relativeAgo } from "@/lib/market/format";
import { xSearchUrl } from "@/lib/news/tree";
import { cn } from "@/lib/utils";

export function CoinNews({ symbol }: { symbol: string }) {
  const { items, pair, isError, isLoading } = useCoinNews(symbol);
  const now = useNow(15_000);

  if (!pair) return null;

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">X news</h3>
        <a
          href={xSearchUrl(pair)}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Live on X
        </a>
      </div>
      {isLoading && items.length === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">Reading X tape…</p>
      )}
      {isError && items.length === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          News feed is quiet. Open live search on X.
        </p>
      )}
      {!isLoading && !isError && items.length === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          No tagged posts for {pair.base} in the last window.
        </p>
      )}
      <ul className="mt-3 space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={item.url || xSearchUrl(pair)}
              target="_blank"
              rel="noreferrer"
              className="block rounded-xl border border-transparent px-0 py-0.5 hover:border-border"
            >
              <p className="flex items-center gap-2 text-[11px] uppercase tracking-label text-subtle">
                <span>{item.source === "x" ? "X" : "News"}</span>
                {item.handle && <span>@{item.handle}</span>}
                <span className="font-mono normal-case tracking-normal">
                  {relativeAgo(item.at, now ?? Date.now())}
                </span>
              </p>
              <p
                className={cn(
                  "mt-1 text-sm leading-snug text-muted-foreground",
                  "line-clamp-3",
                )}
              >
                {item.text}
              </p>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
