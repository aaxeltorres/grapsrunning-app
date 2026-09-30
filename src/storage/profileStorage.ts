import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createEmptyProfile,
  RUNNER_PROFILE_SCHEMA_VERSION,
  type RunnerProfile,
} from '../coach/runnerProfile';

/**
 * Runner profile persistence. Stored on the device for now; this is the
 * only file to change when the profile moves to a real database.
 */

const RUNNER_PROFILE_KEY = 'runner_profile';

function isRunnerProfile(value: unknown): value is RunnerProfile {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as RunnerProfile).schemaVersion === RUNNER_PROFILE_SCHEMA_VERSION
  );
}

export const profileStorage = {
  /** The saved profile, or an empty one when nothing (valid) is stored. */
  async get(): Promise<RunnerProfile> {
    const raw = await AsyncStorage.getItem(RUNNER_PROFILE_KEY);
    if (!raw) return createEmptyProfile();

    try {
      const parsed: unknown = JSON.parse(raw);
      return isRunnerProfile(parsed) ? parsed : createEmptyProfile();
    } catch {
      return createEmptyProfile();
    }
  },

  async save(profile: RunnerProfile): Promise<void> {
    const stamped: RunnerProfile = {
      ...profile,
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(RUNNER_PROFILE_KEY, JSON.stringify(stamped));
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(RUNNER_PROFILE_KEY);
  },
};
