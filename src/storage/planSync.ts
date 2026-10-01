import { extendPlan } from '../coach/generatePlan';
import type { Plan } from '../coach/plan';
import { planStorage } from './planStorage';
import { profileStorage } from './profileStorage';

/**
 * The saved plan, brought up to date: a weekly plan gets the current week
 * once it starts (see `extendPlan`), and the result is saved. Use it
 * wherever the app opens on the plan (the Plan screen, Today's workout).
 * Returns `null` when no plan is stored.
 */
export async function loadCurrentPlan(): Promise<Plan | null> {
  const [plan, profile] = await Promise.all([
    planStorage.get(),
    profileStorage.get(),
  ]);
  if (!plan) return null;
  const current = await extendPlan(plan, profile);
  if (current !== plan) await planStorage.save(current);
  return current;
}
