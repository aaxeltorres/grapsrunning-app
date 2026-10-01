import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildTranscript } from '../coach/conversation';
import { generatePlan } from '../coach/generatePlan';
import type { Plan } from '../coach/plan';
import { planOnboardingScript } from '../coach/planOnboardingScript';
import { createEmptyProfile, type RunnerProfile } from '../coach/runnerProfile';
import { planStorage } from '../storage/planStorage';
import { profileStorage } from '../storage/profileStorage';

const PLAN_ONBOARDING_DONE_KEY = 'plan_onboarding_done';

export type PlanOnboardingStatus = 'loading' | 'pending' | 'done';

function isProfileComplete(profile: RunnerProfile) {
  return buildTranscript(planOnboardingScript, profile, {
    recapConfirmed: true,
  }).isComplete;
}

async function createAndSavePlan(profile: RunnerProfile): Promise<Plan> {
  const plan = await generatePlan(profile);
  await planStorage
    .save(plan)
    .catch((error) => console.warn('Failed to save plan', error));
  return plan;
}

/**
 * State of the Plan section: whether Mike's onboarding is done, the
 * answers saved so far (to resume a half-finished conversation) and the
 * training plan.
 */
export function usePlanOnboarding() {
  const [status, setStatus] = useState<PlanOnboardingStatus>('loading');
  const [profile, setProfile] = useState<RunnerProfile>(createEmptyProfile);
  const [plan, setPlan] = useState<Plan | null>(null);
  const mountedRef = useRef(true);
  // Mirrors `status === 'done'` for callbacks that must stay stable.
  const doneRef = useRef(false);
  doneRef.current = status === 'done';

  useEffect(() => {
    mountedRef.current = true;

    const load = async () => {
      const [flag, storedProfile, storedPlan] = await Promise.all([
        AsyncStorage.getItem(PLAN_ONBOARDING_DONE_KEY).catch(() => null),
        profileStorage.get().catch(() => createEmptyProfile()),
        planStorage.get().catch(() => null),
      ]);
      if (!mountedRef.current) return;
      setProfile(storedProfile);

      if (flag !== 'true') {
        setStatus('pending');
        return;
      }
      if (storedPlan) {
        setPlan(storedPlan);
        setStatus('done');
        return;
      }
      // Finished the onboarding before plans existed: build the plan from
      // the saved answers, without replaying the chat.
      if (isProfileComplete(storedProfile)) {
        const created = await createAndSavePlan(storedProfile);
        if (!mountedRef.current) return;
        setPlan(created);
        setStatus('done');
        return;
      }
      // Nothing to build a plan from: let Mike ask.
      setStatus('pending');
    };

    load().catch((error) => {
      console.warn('Failed to load Plan', error);
      if (mountedRef.current) setStatus('pending');
    });

    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * The user confirmed their answers: marks the onboarding as done and
   * builds and saves the plan. `status` stays 'pending' so Mike can
   * finish the conversation; call `finish` to show the plan.
   */
  const confirm = useCallback(async (confirmedProfile: RunnerProfile) => {
    setProfile(confirmedProfile);
    AsyncStorage.setItem(PLAN_ONBOARDING_DONE_KEY, 'true').catch((error) =>
      console.warn('Failed to save Plan onboarding flag', error),
    );
    try {
      const created = await createAndSavePlan(confirmedProfile);
      if (mountedRef.current) setPlan(created);
    } catch (error) {
      console.warn('Failed to generate plan', error);
    }
  }, []);

  /**
   * Reloads the answers and the plan from storage, e.g. after the profile
   * screen changed them. Does nothing before the onboarding is done.
   */
  const refresh = useCallback(async () => {
    if (!doneRef.current) return;
    try {
      const [storedProfile, storedPlan] = await Promise.all([
        profileStorage.get(),
        planStorage.get(),
      ]);
      if (!mountedRef.current) return;
      setProfile(storedProfile);
      if (storedPlan) setPlan(storedPlan);
    } catch (error) {
      console.warn('Failed to refresh Plan', error);
    }
  }, []);

  /** Replaces the plan (e.g. after a workout was edited) and saves it. */
  const savePlan = useCallback(async (next: Plan) => {
    setPlan(next);
    try {
      await planStorage.save(next);
    } catch (error) {
      console.warn('Failed to save plan', error);
    }
  }, []);

  /** Switches the screen from the onboarding chat to the plan. */
  const finish = useCallback(() => setStatus('done'), []);

  /** Dev helper: clears the flag, answers and plan so everything starts over. */
  const reset = useCallback(async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(PLAN_ONBOARDING_DONE_KEY),
        profileStorage.clear(),
        planStorage.clear(),
      ]);
    } catch (error) {
      console.warn('Failed to reset Plan onboarding', error);
    }
    setProfile(createEmptyProfile());
    setPlan(null);
    setStatus('pending');
  }, []);

  return { status, profile, plan, confirm, finish, reset, refresh, savePlan };
}
