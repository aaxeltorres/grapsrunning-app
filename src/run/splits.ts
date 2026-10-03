/**
 * Per-kilometer splits of a finished run. Pure logic (no React): it works
 * on the timestamped locations that run tracking stores, where an entry
 * with altitude -9999 marks a pause or a resume.
 */

import { calculateDistanceKm } from '../utils/location';

/** The part of a tracked location that splits need. */
export type SplitPoint = {
  timestamp: number;
  coords: { latitude: number; longitude: number; altitude: number | null };
};

export type Split = {
  /** 1 for the first kilometer. */
  index: number;
  distanceKm: number;
  /** Moving time, pauses excluded. */
  seconds: number;
  /** The leftover stretch after the last full kilometer. */
  partial: boolean;
};

const PAUSE_MARKER_ALTITUDE = -9999;

/** A leftover shorter than this is not worth a row. */
const MIN_PARTIAL_KM = 0.1;
/** The slowest bar never gets shorter than this share of the fastest. */
const MIN_BAR_FRACTION = 0.2;

export function splitPace(split: Split): number {
  return split.seconds / split.distanceKm;
}

function isMarker(point: SplitPoint) {
  return point.coords.altitude === PAUSE_MARKER_ALTITUDE;
}

/**
 * Full kilometers in order, plus a last partial row when at least 100 m
 * is left. Empty when the run has no complete kilometer. Time between a
 * pause and its resume is removed, and no distance joins across a pause.
 * The time a kilometer line is crossed is interpolated between the two
 * fixes around it.
 */
export function computeSplits(points: SplitPoint[]): Split[] {
  // Markers come in pause / resume pairs; a trailing unpaired one is a
  // run that ended while paused and removes nothing.
  const markers = points.filter(isMarker).map((p) => p.timestamp);
  const pauses: { start: number; end: number }[] = [];
  for (let i = 0; i + 1 < markers.length; i += 2) {
    if (markers[i + 1] >= markers[i]) {
      pauses.push({ start: markers[i], end: markers[i + 1] });
    }
  }
  const movingMs = (timestamp: number) =>
    timestamp -
    pauses.reduce(
      (total, p) => total + (timestamp >= p.end ? p.end - p.start : 0),
      0,
    );

  let totalKm = 0;
  let startMs: number | null = null;
  let lastMs = 0;
  let previous: SplitPoint | null = null;
  /** Moving time (ms) at the end of each full kilometer. */
  const kmEnds: number[] = [];

  for (const point of points) {
    if (isMarker(point)) {
      previous = null;
      continue;
    }
    const now = movingMs(point.timestamp);
    startMs ??= now;
    lastMs = now;

    if (previous) {
      const before = movingMs(previous.timestamp);
      const stepKm = calculateDistanceKm(
        previous.coords.latitude,
        previous.coords.longitude,
        point.coords.latitude,
        point.coords.longitude,
      );
      while (stepKm > 0 && kmEnds.length + 1 <= totalKm + stepKm) {
        const share = (kmEnds.length + 1 - totalKm) / stepKm;
        kmEnds.push(before + share * (now - before));
      }
      totalKm += stepKm;
    }
    previous = point;
  }

  if (startMs === null || kmEnds.length === 0) return [];

  const splits: Split[] = kmEnds.map((end, i) => ({
    index: i + 1,
    distanceKm: 1,
    seconds: (end - (i === 0 ? startMs! : kmEnds[i - 1])) / 1000,
    partial: false,
  }));

  const leftoverKm = totalKm - kmEnds.length;
  const leftoverSeconds = (lastMs - kmEnds[kmEnds.length - 1]) / 1000;
  if (leftoverKm >= MIN_PARTIAL_KM && leftoverSeconds > 0) {
    splits.push({
      index: kmEnds.length + 1,
      distanceKm: leftoverKm,
      seconds: leftoverSeconds,
      partial: true,
    });
  }
  return splits;
}

/**
 * Index (`Split.index`) of the fastest full kilometer, or `null` when
 * there are fewer than two to compare.
 */
export function fastestSplitIndex(splits: Split[]): number | null {
  const full = splits.filter((s) => !s.partial);
  if (full.length < 2) return null;
  return full.reduce((best, s) => (s.seconds < best.seconds ? s : best)).index;
}

/** Bar length from 0.2 to 1: proportional to speed, the fastest is full. */
export function splitBarFraction(pace: number, fastestPace: number): number {
  if (!(pace > 0) || !(fastestPace > 0)) return MIN_BAR_FRACTION;
  return Math.min(1, Math.max(MIN_BAR_FRACTION, fastestPace / pace));
}
