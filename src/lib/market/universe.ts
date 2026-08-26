export type Interval = "15m" | "1h" | "4h" | "1d";

export type Pair = {
  symbol: string;
  base: string;
  name: string;
};

export const INTERVALS: { id: Interval; label: string }[] = [
  { id: "15m", label: "15m" },
  { id: "1h", label: "1H" },
  { id: "4h", label: "4H" },
  { id: "1d", label: "1D" },
];

export const UNIVERSE: Pair[] = [
  { symbol: "BTCUSDT", base: "BTC", name: "Bitcoin" },
  { symbol: "ETHUSDT", base: "ETH", name: "Ethereum" },
  { symbol: "SOLUSDT", base: "SOL", name: "Solana" },
  { symbol: "BNBUSDT", base: "BNB", name: "BNB" },
  { symbol: "XRPUSDT", base: "XRP", name: "XRP" },
  { symbol: "DOGEUSDT", base: "DOGE", name: "Dogecoin" },
  { symbol: "ADAUSDT", base: "ADA", name: "Cardano" },
  { symbol: "AVAXUSDT", base: "AVAX", name: "Avalanche" },
  { symbol: "LINKUSDT", base: "LINK", name: "Chainlink" },
  { symbol: "TONUSDT", base: "TON", name: "Toncoin" },
  { symbol: "SUIUSDT", base: "SUI", name: "Sui" },
  { symbol: "TRXUSDT", base: "TRX", name: "TRON" },
  { symbol: "DOTUSDT", base: "DOT", name: "Polkadot" },
  { symbol: "NEARUSDT", base: "NEAR", name: "NEAR" },
  { symbol: "APTUSDT", base: "APT", name: "Aptos" },
  { symbol: "UNIUSDT", base: "UNI", name: "Uniswap" },
  { symbol: "AAVEUSDT", base: "AAVE", name: "Aave" },
  { symbol: "LTCUSDT", base: "LTC", name: "Litecoin" },
  { symbol: "BCHUSDT", base: "BCH", name: "Bitcoin Cash" },
  { symbol: "ARBUSDT", base: "ARB", name: "Arbitrum" },
  { symbol: "OPUSDT", base: "OP", name: "Optimism" },
  { symbol: "INJUSDT", base: "INJ", name: "Injective" },
  { symbol: "ATOMUSDT", base: "ATOM", name: "Cosmos" },
  { symbol: "FILUSDT", base: "FIL", name: "Filecoin" },
  { symbol: "RENDERUSDT", base: "RENDER", name: "Render" },
  { symbol: "PEPEUSDT", base: "PEPE", name: "Pepe" },
  { symbol: "SHIBUSDT", base: "SHIB", name: "Shiba Inu" },
  { symbol: "WIFUSDT", base: "WIF", name: "dogwifhat" },
  { symbol: "TAOUSDT", base: "TAO", name: "Bittensor" },
  { symbol: "HBARUSDT", base: "HBAR", name: "Hedera" },
  { symbol: "FETUSDT", base: "FET", name: "Fetch.ai" },
  { symbol: "SEIUSDT", base: "SEI", name: "Sei" },
  { symbol: "ONDOUSDT", base: "ONDO", name: "Ondo" },
  { symbol: "WLDUSDT", base: "WLD", name: "Worldcoin" },
  { symbol: "ENAUSDT", base: "ENA", name: "Ethena" },
  { symbol: "XLMUSDT", base: "XLM", name: "Stellar" },
  { symbol: "TIAUSDT", base: "TIA", name: "Celestia" },
  { symbol: "JUPUSDT", base: "JUP", name: "Jupiter" },
  { symbol: "POLUSDT", base: "POL", name: "Polygon" },
  { symbol: "CRVUSDT", base: "CRV", name: "Curve" },
];

export const HIGHER_TF: Record<Interval, Interval | null> = {
  "15m": "1h",
  "1h": "4h",
  "4h": "1d",
  "1d": null,
};

export const PAIR_BY_SYMBOL = new Map(UNIVERSE.map((p) => [p.symbol, p]));

export const DEFAULT_WATCHLIST = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "SUIUSDT",
  "PEPEUSDT",
] as const;

export function pairLabel(symbol: string) {
  const pair = PAIR_BY_SYMBOL.get(symbol);
  return pair ? `${pair.base} / USDT` : symbol.replace("USDT", " / USDT");
}
