import type { AgentEvent } from "@/lib/agents/types";
import type { PaperFill } from "@/lib/market/types";

function csvEscape(value: string | number | null | undefined) {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadDeskCsv(fills: PaperFill[], events: AgentEvent[]) {
  const fillLines = [
    ["id", "symbol", "base", "side", "interval", "entry", "stop", "target", "qty", "riskUsd", "openedAt", "closedAt", "result", "r", "pnlUsd", "venue"].join(","),
    ...fills.map((f) =>
      [
        f.id,
        f.symbol,
        f.base,
        f.side,
        f.interval,
        f.entry,
        f.stop,
        f.target,
        f.qty,
        f.riskUsd,
        new Date(f.openedAt).toISOString(),
        f.closedAt ? new Date(f.closedAt).toISOString() : "",
        f.result,
        f.r ?? "",
        f.pnlUsd ?? "",
        f.venue ?? "paper",
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];
  const eventLines = [
    "",
    ["at", "agent", "title", "detail"].join(","),
    ...events.map((e) =>
      [new Date(e.at).toISOString(), e.agent, e.title, e.detail].map(csvEscape).join(","),
    ),
  ];
  const blob = new Blob([[...fillLines, ...eventLines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `meridian-blotter-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
