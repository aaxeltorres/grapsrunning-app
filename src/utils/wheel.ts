// Pure math of the wheel picker (no React Native), so the component and a
// throwaway check script share it. A row is always a function of the scroll
// offset: the row under the selection band is `round(offset / ROW_HEIGHT)`.

export const ROW_HEIGHT = 44;

/**
 * A release slower than this (points per millisecond, what UIKit reports)
 * would carry the wheel less than about half a row, so the row nearest to
 * where the finger lifted is the right one. Faster releases are flicks and
 * keep their native momentum.
 */
export const SLOW_RELEASE_VELOCITY = 0.2;

/** Closer than this (points) to a row's offset counts as resting on it. */
export const ON_ROW_TOLERANCE = 0.5;

/** At most one haptic tick per this many ms, so a hard flick buzzes
 * steadily instead of queueing a call per row. */
export const TICK_MIN_INTERVAL_MS = 30;

/** Scroll offset that puts `index` under the selection band. */
export function rowOffset(index: number): number {
  return index * ROW_HEIGHT;
}

/** Row nearest to `offset`, clamped to the list (overscroll at the ends
 * and a bad value never select an out-of-range row). */
export function nearestRow(offset: number, lastIndex: number): number {
  if (!Number.isFinite(offset)) return 0;
  const last = Math.max(0, lastIndex);
  return Math.min(last, Math.max(0, Math.round(offset / ROW_HEIGHT)));
}

/** True when `offset` rests between rows (or past the ends). */
export function isOffRow(offset: number, lastIndex: number): boolean {
  const row = nearestRow(offset, lastIndex);
  return Math.abs(offset - rowOffset(row)) > ON_ROW_TOLERANCE;
}

export function isSlowRelease(velocity: number): boolean {
  return Math.abs(velocity) < SLOW_RELEASE_VELOCITY;
}

export function canTick(now: number, lastTickAt: number): boolean {
  return now - lastTickAt >= TICK_MIN_INTERVAL_MS;
}
