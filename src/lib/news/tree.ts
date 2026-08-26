import { UNIVERSE, type Pair } from "@/lib/market/universe";

const TREE = "https://news.treeofalpha.com/api/news?limit=80";

export type NewsItem = {
  id: string;
  source: "x" | "news";
  title: string;
  text: string;
  handle: string;
  author: string;
  url: string;
  at: number;
  coins: string[];
};

type TreeSuggestion = {
  coin?: string;
  symbols?: { symbol?: string }[];
};

type TreeRaw = {
  _id?: string;
  source?: string;
  title?: string;
  url?: string;
  time?: number;
  suggestions?: TreeSuggestion[];
};

function splitTitle(title: string) {
  const m = title.match(/^(.+?)\s*\(@([A-Za-z0-9_]+)\):\s*([\s\S]+)$/);
  if (m) {
    return { author: m[1]!.trim(), handle: m[2]!, text: m[3]!.trim() };
  }
  return { author: "", handle: "", text: title.trim() };
}

function coinsOn(raw: TreeRaw): string[] {
  const out = new Set<string>();
  for (const s of raw.suggestions ?? []) {
    if (s.coin) out.add(s.coin.toUpperCase());
    for (const sym of s.symbols ?? []) {
      const ticker = String(sym.symbol ?? "").toUpperCase();
      if (ticker.endsWith("USDT")) out.add(ticker.slice(0, -4));
    }
  }
  return [...out];
}

export function parseTreeNews(raw: TreeRaw[]): NewsItem[] {
  return raw
    .map((row) => {
      const title = String(row.title ?? "").trim();
      if (!title) return null;
      const split = splitTitle(title);
      const source = String(row.source ?? "").toLowerCase() === "twitter" ? "x" : "news";
      return {
        id: String(row._id ?? row.url ?? title),
        source,
        title,
        text: split.text,
        handle: split.handle,
        author: split.author,
        url: String(row.url ?? ""),
        at: Number(row.time ?? Date.now()),
        coins: coinsOn(row),
      } satisfies NewsItem;
    })
    .filter((row): row is NewsItem => row != null)
    .sort((a, b) => b.at - a.at);
}

export async function fetchTreeNews(): Promise<NewsItem[]> {
  const res = await fetch(TREE, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`News ${res.status}`);
  const json = (await res.json()) as TreeRaw[];
  if (!Array.isArray(json)) return [];
  return parseTreeNews(json);
}

export function xSearchUrl(pair: Pair) {
  const q = `$${pair.base} OR ${pair.name}`;
  return `https://x.com/search?q=${encodeURIComponent(q)}&f=live&src=typed_query`;
}

function textMentions(item: NewsItem, pair: Pair): boolean {
  const hay = `${item.title} ${item.text}`.toLowerCase();
  const ticker = pair.base.toLowerCase();
  if (hay.includes(`$${ticker}`)) return true;
  const name = pair.name.toLowerCase();
  if (name.length >= 4 && hay.includes(name)) return true;
  if (ticker.length >= 4 && new RegExp(`\\b${ticker}\\b`, "i").test(hay)) return true;
  return false;
}

export function newsForPair(items: NewsItem[], pair: Pair): NewsItem[] {
  return items.filter(
    (item) => item.coins.includes(pair.base) || textMentions(item, pair),
  );
}

export function newsForUniverse(items: NewsItem[]): { item: NewsItem; pair: Pair }[] {
  const byBase = new Map(UNIVERSE.map((p) => [p.base, p]));
  const out: { item: NewsItem; pair: Pair }[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    let pair: Pair | undefined;
    for (const coin of item.coins) {
      pair = byBase.get(coin);
      if (pair) break;
    }
    if (!pair) {
      pair = UNIVERSE.find((p) => textMentions(item, p));
    }
    if (!pair) continue;
    const key = item.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ item, pair });
  }
  return out;
}
