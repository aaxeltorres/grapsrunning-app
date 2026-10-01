import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  INTERVAL_SETUP_VERSION,
  normalizeSetup,
  type IntervalSetup,
} from '../run/intervalSetup';

/**
 * The last "Intervals" setup the runner used. Stored on the device for
 * now; this is the only file to change when it moves to a real database.
 */

const INTERVAL_SETUP_KEY = 'interval_setup';

export const intervalStorage = {
  /** The last setup (fixed up to the current limits), or `null` when none is stored. */
  async get(): Promise<IntervalSetup | null> {
    const raw = await AsyncStorage.getItem(INTERVAL_SETUP_KEY);
    if (!raw) return null;

    try {
      const parsed: unknown = JSON.parse(raw);
      const valid =
        typeof parsed === 'object' &&
        parsed !== null &&
        (parsed as IntervalSetup).schemaVersion === INTERVAL_SETUP_VERSION;
      return valid ? normalizeSetup(parsed) : null;
    } catch {
      return null;
    }
  },

  async save(setup: IntervalSetup): Promise<void> {
    await AsyncStorage.setItem(INTERVAL_SETUP_KEY, JSON.stringify(setup));
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(INTERVAL_SETUP_KEY);
  },
};
