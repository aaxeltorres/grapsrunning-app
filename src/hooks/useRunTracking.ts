import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { useKeepAwake } from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import {
  calculateDistanceKm,
  calculateRollingPaceSeconds,
  createLocationAccuracyGate,
  isValidLocation,
  smoothPaceSeconds,
} from '../utils/location';
import { formatPaceSeconds, hasEnoughPaceData, PACE_PLACEHOLDER } from '../utils/format';
import {
  LOCATION_TASK_NAME,
  ACTIVE_RUN_DATA_KEY,
  resetBackgroundLocationAccuracyGate,
} from '../tasks/locationTask';

export type RunState = 'idle' | 'running' | 'paused' | 'finished';

export type PermissionState = 'granted' | 'denied' | 'pending';

interface UseRunTrackingResult {
  runState: RunState;
  permissionState: PermissionState;
  distanceKm: number;
  durationSeconds: number;
  paceLabel: string;
  calories: number;
  route: Location.LocationObject[];
  startRun: () => Promise<void>;
  pauseRun: () => Promise<void>;
  resumeRun: () => Promise<void>;
  finishRun: () => Promise<void>;
  discardRun: () => Promise<void>;
  requestPermissions: () => Promise<void>;
}

function createPauseMarker(timestamp: number): Location.LocationObject {
  return {
    coords: {
      latitude: 0,
      longitude: 0,
      altitude: -9999,
      accuracy: 0,
      altitudeAccuracy: 0,
      heading: 0,
      speed: 0,
    },
    timestamp,
  };
}

export function useRunTracking(): UseRunTrackingResult {
  const [runState, setRunState] = useState<RunState>('idle');
  const [permissionState, setPermissionState] = useState<PermissionState>('pending');
  
  // Metrics
  const [distanceKm, setDistanceKm] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [route, setRoute] = useState<Location.LocationObject[]>([]);
  const [displayedPaceSeconds, setDisplayedPaceSeconds] = useState<number | null>(null);
  
  // Timer calculation
  const [startTime, setStartTime] = useState<number | null>(null);
  const [totalPausedTimeMs, setTotalPausedTimeMs] = useState(0);
  const [pauseStartTime, setPauseStartTime] = useState<number | null>(null);

  // Expo Go foreground fallback
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const locationAccuracyGateRef = useRef(createLocationAccuracyGate());
  const isPausedRef = useRef(false);
  const durationSecondsRef = useRef(0);
  const smoothedPaceRef = useRef<number | null>(null);
  const lastPacePointTimestampRef = useRef<number | null>(null);
  
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  
  // keep screen awake during the run
  useKeepAwake();

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    try {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        setPermissionState('denied');
        return;
      }

      // In Expo Go or on web, background permissions aren't available —
      // foreground-only is fine (we use watchPositionAsync + KeepAwake).
      if (!isExpoGo && Platform.OS !== 'web') {
        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        if (bgStatus !== 'granted') {
          console.warn('[useRunTracking] Background permission denied — falling back to foreground-only tracking.');
        }
      }

      setPermissionState('granted');
    } catch (e) {
      console.warn('Error requesting permissions', e);
      setPermissionState('denied');
    }
  };

  // Timer loop for UI updates
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (runState === 'running' && startTime !== null) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsedMs = now - startTime - totalPausedTimeMs;
        const nextDurationSeconds = Math.floor(elapsedMs / 1000);
        durationSecondsRef.current = nextDurationSeconds;
        setDurationSeconds(nextDurationSeconds);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [runState, startTime, totalPausedTimeMs]);

  // Polling AsyncStorage for background task updates
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (runState === 'running' && !isExpoGo && Platform.OS !== 'web') {
      interval = setInterval(async () => {
        try {
          const stored = await AsyncStorage.getItem(ACTIVE_RUN_DATA_KEY);
          if (stored) {
            const locations: Location.LocationObject[] = JSON.parse(stored);
            recalculateMetricsFromLocations(locations);
          }
        } catch (e) {
          console.error(e);
        }
      }, 2000); // Check every 2 seconds
    }
    return () => clearInterval(interval);
  }, [runState, isExpoGo]);

  const recalculateMetricsFromLocations = (locations: Location.LocationObject[]) => {
    // Walk the location array, treating altitude === -9999 entries as
    // pause markers that reset the "previous" reference so we never
    // accumulate distance across a pause gap.
    let totalDist = 0;
    let prev: Location.LocationObject | null = null;

    for (const loc of locations) {
      if (loc.coords.altitude === -9999) {
        prev = null;
        continue;
      }
      if (prev) {
        totalDist += calculateDistanceKm(
          prev.coords.latitude,
          prev.coords.longitude,
          loc.coords.latitude,
          loc.coords.longitude
        );
      }
      prev = loc;
    }

    setDistanceKm(totalDist);
    setRoute(locations);

    const latestLocation = [...locations]
      .reverse()
      .find((location) => location.coords.altitude !== -9999);
    if (
      !isPausedRef.current &&
      latestLocation &&
      latestLocation.timestamp !== lastPacePointTimestampRef.current
    ) {
      lastPacePointTimestampRef.current = latestLocation.timestamp;
      const averagePace = totalDist > 0
        ? durationSecondsRef.current / totalDist
        : null;
      const rollingPace = calculateRollingPaceSeconds(locations, averagePace);
      const nextPace = smoothPaceSeconds(smoothedPaceRef.current, rollingPace);
      smoothedPaceRef.current = nextPace;
      setDisplayedPaceSeconds(nextPace);
    }
  };

  const updateMovingDuration = (timestamp: number) => {
    if (startTime === null) return durationSecondsRef.current;
    const movingDuration = Math.max(
      0,
      Math.floor((timestamp - startTime - totalPausedTimeMs) / 1000),
    );
    durationSecondsRef.current = movingDuration;
    setDurationSeconds(movingDuration);
    return movingDuration;
  };

  const startRun = async () => {
    if (permissionState !== 'granted') return;
    
    await cleanup();
    isPausedRef.current = false;
    locationAccuracyGateRef.current = createLocationAccuracyGate();
    resetBackgroundLocationAccuracyGate();
    durationSecondsRef.current = 0;
    smoothedPaceRef.current = null;
    lastPacePointTimestampRef.current = null;
    setDisplayedPaceSeconds(null);
    setStartTime(Date.now());
    setTotalPausedTimeMs(0);
    setPauseStartTime(null);
    setRunState('running');
    
    await startLocationUpdates();
  };

  const pauseRun = async () => {
    if (runState !== 'running') return;
    const pausedAt = Date.now();
    const movingDuration = updateMovingDuration(pausedAt);
    const averagePace = distanceKm > 0 ? movingDuration / distanceKm : null;
    smoothedPaceRef.current = averagePace;
    setDisplayedPaceSeconds(averagePace);
    isPausedRef.current = true;
    setRunState('paused');
    setPauseStartTime(pausedAt);
    await stopLocationUpdates();
    
    // Inject pause marker
    try {
       const stored = await AsyncStorage.getItem(ACTIVE_RUN_DATA_KEY);
       const locations: Location.LocationObject[] = stored ? JSON.parse(stored) : [];
       locations.push(createPauseMarker(Date.now()));
       await AsyncStorage.setItem(ACTIVE_RUN_DATA_KEY, JSON.stringify(locations));
       recalculateMetricsFromLocations(locations);
    } catch (e) {}
  };

  const resumeRun = async () => {
    if (runState !== 'paused' || pauseStartTime === null) return;
    const now = Date.now();
    try {
      const stored = await AsyncStorage.getItem(ACTIVE_RUN_DATA_KEY);
      const locations: Location.LocationObject[] = stored ? JSON.parse(stored) : [];
      locations.push(createPauseMarker(now));
      await AsyncStorage.setItem(ACTIVE_RUN_DATA_KEY, JSON.stringify(locations));
      recalculateMetricsFromLocations(locations);
    } catch (e) {
      console.error('Failed to save run resume marker', e);
    }
    isPausedRef.current = false;
    setTotalPausedTimeMs(prev => prev + (now - pauseStartTime));
    setPauseStartTime(null);
    setRunState('running');
    await startLocationUpdates();
  };

  const finishRun = async () => {
    setRunState('finished');
    if (pauseStartTime) {
       setTotalPausedTimeMs(prev => prev + (Date.now() - pauseStartTime));
    }
    await stopLocationUpdates();
  };

  const discardRun = async () => {
    await stopLocationUpdates();
    await cleanup();
    setRunState('idle');
  };

  const startLocationUpdates = async () => {
    if (Platform.OS === 'web') {
      console.log('Web fallback: simulated location updates not implemented');
      return;
    }
    
    if (isExpoGo) {
      console.log('[useRunTracking] Running in Expo Go: using watchPositionAsync (Foreground only)');
      startForegroundWatch();
    } else {
      // Check if we actually have background permission
      const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
      if (bgStatus === 'granted') {
        console.log('[useRunTracking] Running in build: using startLocationUpdatesAsync (Background support)');
        const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (!hasStarted) {
          await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
            accuracy: Location.Accuracy.BestForNavigation,
            activityType: Location.ActivityType.Fitness,
            pausesUpdatesAutomatically: false,
            showsBackgroundLocationIndicator: true,
            distanceInterval: 5,
            deferredUpdatesDistance: 5,
            deferredUpdatesInterval: 2000,
          });
        }
      } else {
        console.log('[useRunTracking] No background permission in build — using foreground fallback');
        startForegroundWatch();
      }
    }
  };

  const startForegroundWatch = async () => {
    locationSubRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 5,
      },
      async (loc) => {
        try {
          if (!locationAccuracyGateRef.current(loc)) return;
          const stored = await AsyncStorage.getItem(ACTIVE_RUN_DATA_KEY);
          const locations: Location.LocationObject[] = stored ? JSON.parse(stored) : [];
          const prev = locations.length > 0 ? locations[locations.length - 1] : null;
          if (prev?.coords?.altitude === -9999 || isValidLocation(loc, prev)) {
            locations.push(loc);
            await AsyncStorage.setItem(ACTIVE_RUN_DATA_KEY, JSON.stringify(locations));
            recalculateMetricsFromLocations(locations);
          }
        } catch (e) {}
      }
    );
  };

  const stopLocationUpdates = async () => {
    if (locationSubRef.current) {
      locationSubRef.current.remove();
      locationSubRef.current = null;
    }
    
    if (Platform.OS !== 'web' && !isExpoGo) {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (hasStarted) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
    }
  };

  const cleanup = async () => {
    setDistanceKm(0);
    setDurationSeconds(0);
    durationSecondsRef.current = 0;
    setRoute([]);
    setDisplayedPaceSeconds(null);
    smoothedPaceRef.current = null;
    lastPacePointTimestampRef.current = null;
    await AsyncStorage.removeItem(ACTIVE_RUN_DATA_KEY);
  };

  const paceLabel = hasEnoughPaceData(durationSeconds, distanceKm)
    ? formatPaceSeconds(displayedPaceSeconds)
    : PACE_PLACEHOLDER;
  const calories = Math.floor(distanceKm * 65);

  return {
    runState,
    permissionState,
    distanceKm,
    durationSeconds,
    paceLabel,
    calories,
    route,
    startRun,
    pauseRun,
    resumeRun,
    finishRun,
    discardRun,
    requestPermissions,
  };
}
