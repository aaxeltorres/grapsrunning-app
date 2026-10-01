import React from 'react';
import type { RunViewProps } from '../run/types';
import BasicRunView from './BasicRunView';

/**
 * Run screen for the "Today's workout" mode.
 *
 * TODO: not built yet. Execute the workout segment by segment (warm-up,
 * reps, cool-down) with target paces. Until then it renders the basic run
 * screen so a run never dead-ends.
 */
export default function PlanRunView(props: RunViewProps) {
  return <BasicRunView {...props} />;
}
