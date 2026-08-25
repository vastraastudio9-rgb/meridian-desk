import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Candle } from "@/lib/market/types";
import { formatPrice } from "@/lib/market/format";

export function PriceChart({ candles }: { candles: Candle[] }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const data = useMemo(() => {
    const step = candles.length > 80 ? Math.ceil(candles.length / 64) : 1;
    return candles.filter((_, i) => i % step === 0 || i === candles.length - 1).map((c) => ({
      t: c.t,
      c: c.c,
    }));
  }, [candles]);

  if (!ready) {
    return <div className="h-48 w-full" aria-hidden="true" />;
  }

  if (data.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Not enough candles
      </div>
    );
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="meridianFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-foreground)" stopOpacity={0.16} />
              <stop offset="100%" stopColor="var(--color-foreground)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" hide />
          <YAxis
            domain={["auto", "auto"]}
            width={52}
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
            tickFormatter={(v: number) => formatPrice(v)}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ stroke: "var(--color-border-strong)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const point = payload[0].payload as { t: number; c: number };
              return (
                <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs">
                  <p className="font-mono tabular-nums">{formatPrice(point.c)}</p>
                  <p className="text-muted-foreground">
                    {new Date(point.t).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="c"
            stroke="var(--color-foreground)"
            strokeWidth={1.5}
            fill="url(#meridianFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
