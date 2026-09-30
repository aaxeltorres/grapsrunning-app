import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PLAN_ONBOARDING_DONE_KEY = 'plan_onboarding_done';

export type PlanOnboardingStatus = 'loading' | 'pending' | 'done';

/**
 * Persists whether the user has already seen Mike's Plan onboarding.
 */
export function usePlanOnboarding() {
  const [status, setStatus] = useState<PlanOnboardingStatus>('loading');

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(PLAN_ONBOARDING_DONE_KEY)
      .then((value) => {
        if (active) setStatus(value === 'true' ? 'done' : 'pending');
      })
      .catch(() => {
        if (active) setStatus('pending');
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

  /** Dev helper: clears the flag so the onboarding plays again. */
  const reset = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(PLAN_ONBOARDING_DONE_KEY);
    } catch (error) {
      console.warn('Failed to reset Plan onboarding flag', error);
    }
    setStatus('pending');
  }, []);

  return { status, markDone, reset };
}
