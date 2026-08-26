import { useTapeNews } from "@/hooks/use-news";
import { useNow } from "@/hooks/use-now";
import { relativeAgo } from "@/lib/market/format";

export function NewsTape({ onSelect }: { onSelect: (symbol: string) => void }) {
  const { rows } = useTapeNews();
  const now = useNow(15_000);

  if (rows.length === 0) {
    return (
      <div className="flex h-9 items-center border-b border-border bg-card px-4">
        <p className="text-xs text-subtle">X news · watching the tape</p>
      </div>
    );
  }

  const loop = [...rows, ...rows];

  return (
    <div className="relative h-9 overflow-hidden border-b border-border bg-card">
      <div className="ticker-track">
        {loop.map(({ item, pair }, i) => (
          <button
            key={`${item.id}-${i}`}
            type="button"
            onClick={() => onSelect(pair.symbol)}
            className="flex h-9 shrink-0 items-center gap-2 border-r border-border px-4 text-xs whitespace-nowrap"
          >
            <span className="text-subtle">X</span>
            <span className="font-medium tracking-wide">${pair.base}</span>
            {item.handle && (
              <span className="text-muted-foreground">@{item.handle}</span>
            )}
            <span className="max-w-[28rem] truncate text-muted-foreground">
              {item.text}
            </span>
            <span className="font-mono tabular-nums text-subtle">
              {relativeAgo(item.at, now ?? Date.now())}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
