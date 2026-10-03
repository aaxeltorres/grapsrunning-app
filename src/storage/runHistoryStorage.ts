import AsyncStorage from '@react-native-async-storage/async-storage';
import { SAVED_RUN_SCHEMA_VERSION, type SavedRun } from '../run/types';

/**
 * Run history persistence: the finished runs worth keeping (see
 * `isRunSaveable`). Stored on the device for now; this is the only file to
 * change when runs move to a real database.
 */

const RUN_HISTORY_KEY = 'run_history_v1';

function isSavedRun(value: unknown): value is SavedRun {
  if (typeof value !== 'object' || value === null) return false;
  const run = value as SavedRun;
  return (
    run.schemaVersion === SAVED_RUN_SCHEMA_VERSION &&
    typeof run.id === 'string' &&
    typeof run.startedAt === 'string' &&
    Number.isFinite(run.distanceMeters) &&
    Number.isFinite(run.movingDurationSec) &&
    Array.isArray(run.route) &&
    Array.isArray(run.splits)
  );
}

/** Every stored run, in storage order; empty when nothing (valid) is stored. */
async function readAll(): Promise<SavedRun[]> {
  try {
    const raw = await AsyncStorage.getItem(RUN_HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSavedRun) : [];
  } catch {
    return [];
  }
}

/** Runs the writes one after another, so two quick saves can't overwrite each other. */
let writeQueue: Promise<unknown> = Promise.resolve();

function queued<T>(task: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(task, task);
  writeQueue = next.catch(() => undefined);
  return next;
}

export const runHistoryStorage = {
  /** Every saved run, newest first. Never throws: a corrupt store reads as empty. */
  async loadRuns(): Promise<SavedRun[]> {
    const runs = await readAll();
    return runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  },

  /** Saves the run, replacing the one with the same id, so it is never duplicated. */
  saveRun(run: SavedRun): Promise<void> {
    return queued(async () => {
      const runs = (await readAll()).filter((saved) => saved.id !== run.id);
      runs.push(run);
      await AsyncStorage.setItem(RUN_HISTORY_KEY, JSON.stringify(runs));
    });
  },

  async getRun(id: string): Promise<SavedRun | null> {
    const runs = await readAll();
    return runs.find((run) => run.id === id) ?? null;
  },

  deleteRun(id: string): Promise<void> {
    return queued(async () => {
      const runs = await readAll();
      const rest = runs.filter((run) => run.id !== id);
      if (rest.length !== runs.length) {
        await AsyncStorage.setItem(RUN_HISTORY_KEY, JSON.stringify(rest));
      }
    });
  },
};
