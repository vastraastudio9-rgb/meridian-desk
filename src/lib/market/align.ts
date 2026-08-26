import type { Side } from "./types";
import type { Interval } from "./universe";

/** True only when the higher timeframe actually agrees. Wait/null is not a pass. */
export function sidesAligned(
  side: Side,
  higher: Interval | null,
  higherSide: Side | null,
): boolean {
  if (side === "wait") return false;
  if (!higher) return true;
  return higherSide === side;
}
