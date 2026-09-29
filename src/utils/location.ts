import * as Location from 'expo-location';

const EARTH_RADIUS_KM = 6371;
const PAUSE_MARKER_ALTITUDE = -9999;
const PACE_WINDOW_MS = 25_000;
const MIN_PACE_WINDOW_DISTANCE_KM = 0.03;
const MIN_PACE_WINDOW_DURATION_MS = 10_000;
const MIN_PACE_WINDOW_POINTS = 3;
const MIN_PACE_SECONDS_PER_KM = 2 * 60;
const MAX_PACE_SECONDS_PER_KM = 20 * 60;

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

/**
 * Haversine formula to calculate distance in KM between two coordinates
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Filter points based on accuracy and implicit speed to avoid GPS jumps
 */
export function isValidLocation(
  current: Location.LocationObject,
  previous: Location.LocationObject | null
): boolean {
  // Discard points with bad accuracy (e.g. > 25 meters)
  if (current.coords.accuracy && current.coords.accuracy > 25) {
    return false;
  }

  if (!previous) return true;

  const distanceKm = calculateDistanceKm(
    previous.coords.latitude,
    previous.coords.longitude,
    current.coords.latitude,
    current.coords.longitude
  );

  const timeDiffSeconds = (current.timestamp - previous.timestamp) / 1000;
  
  if (timeDiffSeconds <= 0) return false;

  const speedMetersPerSecond = (distanceKm * 1000) / timeDiffSeconds;

  // Discard jumps implying speed > 12 m/s (approx 43 km/h, impossible for running)
  if (speedMetersPerSecond > 12) {
    return false;
  }

  return true;
}

function isUsablePace(paceSecondsPerKm: number | null): paceSecondsPerKm is number {
  return (
    paceSecondsPerKm !== null &&
    Number.isFinite(paceSecondsPerKm) &&
    paceSecondsPerKm >= MIN_PACE_SECONDS_PER_KM &&
    paceSecondsPerKm <= MAX_PACE_SECONDS_PER_KM
  );
}

/**
 * Calculates current pace from a 25-second moving-time GPS window. Paired
 * pause markers remove paused time and prevent distance joining across pauses.
 * Falls back to average pace when the GPS window is too sparse or short.
 * Example: 06:18 / 1.07 km is about 5:53/km (about 5:52/km at full precision).
 */
export function calculateRollingPaceSeconds(
  locations: Location.LocationObject[],
  averagePaceSecondsPerKm: number | null,
): number | null {
  const fallbackPace = isUsablePace(averagePaceSecondsPerKm)
    ? averagePaceSecondsPerKm
    : null;
  const pauseMarkers = locations
    .filter((location) => location.coords.altitude === PAUSE_MARKER_ALTITUDE)
    .map((location) => location.timestamp);
  const pauses: { start: number; end: number }[] = [];

  for (let index = 0; index + 1 < pauseMarkers.length; index += 2) {
    const start = pauseMarkers[index];
    const end = pauseMarkers[index + 1];
    if (end >= start) pauses.push({ start, end });
  }

  const points: {
    location: Location.LocationObject;
    movingTimestamp: number;
    segment: number;
  }[] = [];
  let segment = 0;

  for (const location of locations) {
    if (location.coords.altitude === PAUSE_MARKER_ALTITUDE) {
      segment += 1;
      continue;
    }

    const pausedBeforePointMs = pauses.reduce(
      (total, pause) => total + (location.timestamp >= pause.end ? pause.end - pause.start : 0),
      0,
    );
    points.push({
      location,
      movingTimestamp: location.timestamp - pausedBeforePointMs,
      segment,
    });
  }

  const latest = points[points.length - 1];
  if (!latest) return fallbackPace;

  const windowPoints = points.filter(
    (point) => point.movingTimestamp >= latest.movingTimestamp - PACE_WINDOW_MS,
  );
  if (windowPoints.length < MIN_PACE_WINDOW_POINTS) return fallbackPace;

  const first = windowPoints[0];
  const elapsedMs = latest.movingTimestamp - first.movingTimestamp;
  if (elapsedMs < MIN_PACE_WINDOW_DURATION_MS) return fallbackPace;

  let distanceKm = 0;
  for (let index = 1; index < windowPoints.length; index += 1) {
    const previous = windowPoints[index - 1];
    const current = windowPoints[index];
    if (previous.segment !== current.segment) continue;

    distanceKm += calculateDistanceKm(
      previous.location.coords.latitude,
      previous.location.coords.longitude,
      current.location.coords.latitude,
      current.location.coords.longitude,
    );
  }

  if (distanceKm < MIN_PACE_WINDOW_DISTANCE_KM) return fallbackPace;

  const rollingPace = (elapsedMs / 1000) / distanceKm;
  return isUsablePace(rollingPace) ? rollingPace : fallbackPace;
}

/** Applies a light EMA to avoid visible pace jumps between GPS updates. */
export function smoothPaceSeconds(
  previousPaceSecondsPerKm: number | null,
  nextPaceSecondsPerKm: number | null,
): number | null {
  if (!isUsablePace(nextPaceSecondsPerKm)) return null;
  if (!isUsablePace(previousPaceSecondsPerKm)) return nextPaceSecondsPerKm;

  const alpha = 0.3;
  return previousPaceSecondsPerKm + alpha * (nextPaceSecondsPerKm - previousPaceSecondsPerKm);
}
