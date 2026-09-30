import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createEmptyProfile, type RunnerProfile } from '../coach/runnerProfile';
import { profileStorage } from '../storage/profileStorage';

const PLAN_ONBOARDING_DONE_KEY = 'plan_onboarding_done';

export type PlanOnboardingStatus = 'loading' | 'pending' | 'done';

/**
 * Loads whether the user has finished Mike's Plan onboarding, plus the
 * answers saved so far (to resume a half-finished conversation).
 */
export function usePlanOnboarding() {
  const [status, setStatus] = useState<PlanOnboardingStatus>('loading');
  const [profile, setProfile] = useState<RunnerProfile>(createEmptyProfile);

  useEffect(() => {
    let active = true;

    Promise.all([
      AsyncStorage.getItem(PLAN_ONBOARDING_DONE_KEY).catch(() => null),
      profileStorage.get().catch(() => createEmptyProfile()),
    ]).then(([flag, storedProfile]) => {
      if (!active) return;
      setProfile(storedProfile);
      setStatus(flag === 'true' ? 'done' : 'pending');
    });

    return () => {
      active = false;
    };
  }, []);

  /**
   * Saves the flag for future visits. Leaves `status` untouched so the
   * finished conversation stays on screen for the current visit.
   */
  const markDone = useCallback(async () => {
    try {
      await AsyncStorage.setItem(PLAN_ONBOARDING_DONE_KEY, 'true');
    } catch (error) {
      console.warn('Failed to save Plan onboarding flag', error);
    }
  }, []);

  /** Dev helper: clears the flag and the answers so the onboarding starts over. */
  const reset = useCallback(async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(PLAN_ONBOARDING_DONE_KEY),
        profileStorage.clear(),
      ]);
    } catch (error) {
      console.warn('Failed to reset Plan onboarding', error);
    }
    setProfile(createEmptyProfile());
    setStatus('pending');
  }, []);

  return { status, profile, markDone, reset };
}
