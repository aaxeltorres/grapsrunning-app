import AsyncStorage from '@react-native-async-storage/async-storage';
import { PLAN_SCHEMA_VERSION, type Plan } from '../coach/plan';

/**
 * Training plan persistence. Stored on the device for now; this is the
 * only file to change when plans move to a real database.
 */

const PLAN_KEY = 'training_plan';

function isPlan(value: unknown): value is Plan {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Plan).schemaVersion === PLAN_SCHEMA_VERSION &&
    Array.isArray((value as Plan).workouts)
  );
}

export const planStorage = {
  /** The saved plan, or `null` when nothing (valid) is stored. */
  async get(): Promise<Plan | null> {
    const raw = await AsyncStorage.getItem(PLAN_KEY);
    if (!raw) return null;

    try {
      const parsed: unknown = JSON.parse(raw);
      return isPlan(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },

  async save(plan: Plan): Promise<void> {
    await AsyncStorage.setItem(PLAN_KEY, JSON.stringify(plan));
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(PLAN_KEY);
  },
};
