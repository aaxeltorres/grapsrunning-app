import React from 'react';
import type { RunViewProps } from '../run/types';
import BasicRunView from './BasicRunView';

/**
 * Run screen for the "Set a goal" mode.
 *
 * TODO: not built yet. Show progress toward the chosen distance or time
 * goal. Until then it renders the basic run screen so a run never dead-ends.
 */
export default function GoalRunView(props: RunViewProps) {
  return <BasicRunView {...props} />;
}
