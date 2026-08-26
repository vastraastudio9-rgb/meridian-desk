import type { AlignState, Side } from "./types";
import type { Interval } from "./universe";

/**
 * Higher-TF wait is not a vote.
 *   aligned — HTF is the same side (or there is no HTF, e.g. daily)
 *   against — HTF is the opposite side
 *   pending — HTF is wait / not loaded yet
 *   none    — this pair is itself a wait
 */
export function htfAlign(
  side: Side,
  higher: Interval | null,
  higherSide: Side | null,
): AlignState {
  if (side === "wait") return "none";
  if (!higher) return "aligned";
  if (higherSide == null || higherSide === "wait") return "pending";
  return higherSide === side ? "aligned" : "against";
}

export function sidesAligned(
  side: Side,
  higher: Interval | null,
  higherSide: Side | null,
): boolean {
  return htfAlign(side, higher, higherSide) === "aligned";
}

export function alignBoost(state: AlignState): number {
  if (state === "aligned") return 400;
  if (state === "pending") return 150;
  return 0;
}
