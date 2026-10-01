/**
 * The ways to start a run. The names and descriptions are placeholders:
 * this is the single place to rename them.
 */

export type RunModeId = 'quick' | 'goal' | 'plan';

export type RunMode = {
  id: RunModeId;
  name: string;
  description: string;
};

export const RUN_MODES: Record<RunModeId, RunMode> = {
  quick: {
    id: 'quick',
    name: 'Quick start',
    description: 'Just run. No setup.',
  },
  goal: {
    id: 'goal',
    name: 'Set a goal',
    description: 'Pick a distance or a time to aim for.',
  },
  plan: {
    id: 'plan',
    name: "Today's workout",
    description: 'Follow the workout from your plan.',
  },
};

/** Run mode used when none is given, e.g. "Start workout" on the Plan screen. */
export const DEFAULT_RUN_MODE: RunModeId = 'quick';
