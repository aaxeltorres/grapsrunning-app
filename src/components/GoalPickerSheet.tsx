import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  GOAL_LABELS,
  formatGoalValue,
  goalLimits,
  goalStep,
  type GoalMetric,
} from '../run/goals';
import {
  GOAL_DISTANCE_MAX_M,
  GOAL_DISTANCE_PRESETS,
  GOAL_PACE_MAX_S_PER_KM,
  GOAL_PACE_MIN_S_PER_KM,
  GOAL_PACE_STEP_S,
  GOAL_TIME_MAX_S,
} from '../run/goalConfig';
import { colors, spacing, typography } from '../theme';
import BottomSheet from './BottomSheet';
import Button from './Button';
import Chip from './Chip';
import WheelPicker, { type WheelItem } from './WheelPicker';

const range = (from: number, to: number, step = 1) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

// Wheel rows come from the goal limits and steps, so the wheels and the
// validation can never disagree about what is allowed.
const KM_ITEMS: WheelItem<number>[] = range(0, Math.floor(GOAL_DISTANCE_MAX_M / 1000)).map(
  (n) => ({ value: n, label: String(n) }),
);
const TENTH_ITEMS: WheelItem<number>[] = range(0, 9).map((n) => ({
  value: n,
  label: `.${n} km`,
}));
const HOUR_ITEMS: WheelItem<number>[] = range(0, Math.floor(GOAL_TIME_MAX_S / 3600)).map(
  (n) => ({ value: n, label: `${n} h` }),
);
const MINUTE_ITEMS: WheelItem<number>[] = range(0, 59).map((n) => ({
  value: n,
  label: `${n} min`,
}));
const PACE_MIN_MINUTES = Math.floor(GOAL_PACE_MIN_S_PER_KM / 60);
const PACE_MAX_MINUTES = Math.floor(GOAL_PACE_MAX_S_PER_KM / 60);
const PACE_MINUTE_ITEMS: WheelItem<number>[] = range(
  PACE_MIN_MINUTES,
  PACE_MAX_MINUTES,
).map((n) => ({ value: n, label: String(n) }));
const PACE_SECOND_ITEMS: WheelItem<number>[] = range(0, 60 - GOAL_PACE_STEP_S, GOAL_PACE_STEP_S).map(
  (n) => ({ value: n, label: `:${n.toString().padStart(2, '0')} /km` }),
);

/** Starting point of a goal that isn't set yet. */
const DEFAULT_VALUES: Record<GoalMetric, number> = {
  distance: 5000,
  time: 30 * 60,
  pace: 6 * 60,
};

/** Wheels show whole steps; snap a value onto them. */
function snap(metric: GoalMetric, value: number) {
  if (metric === 'distance') return value; // keeps exact presets such as the half marathon
  const step = goalStep(metric);
  return Math.round(value / step) * step;
}

type Props = {
  /** The goal being edited; `null` keeps the sheet closed. */
  metric: GoalMetric | null;
  /** The current goal, or a suggestion (e.g. the derived value). */
  initialValue?: number;
  /** False for a derived value: it isn't set, so there is nothing to clear. */
  canClear?: boolean;
  onSet: (metric: GoalMetric, value: number) => void;
  onClear: (metric: GoalMetric) => void;
  onDismiss: () => void;
  reduceMotion?: boolean;
};

/** Bottom sheet with wheels to pick one goal: distance, time or pace. */
export default function GoalPickerSheet({
  metric,
  initialValue,
  canClear = true,
  onSet,
  onClear,
  onDismiss,
  reduceMotion,
}: Props) {
  // Kept while the sheet animates out, so its content doesn't vanish.
  const [shown, setShown] = useState<GoalMetric>(metric ?? 'distance');
  const [draft, setDraft] = useState(DEFAULT_VALUES.distance);
  const [openedFor, setOpenedFor] = useState<GoalMetric | null>(null);

  // Reset the draft while rendering the opening frame, so the wheels mount
  // on the right rows instead of scrolling there.
  if (metric !== openedFor) {
    setOpenedFor(metric);
    if (metric) {
      setShown(metric);
      // A suggestion can be out of range (a derived 18:00 /km): open on the limit.
      const { min, max } = goalLimits(metric);
      const start = snap(metric, initialValue ?? DEFAULT_VALUES[metric]);
      setDraft(Math.min(max, Math.max(min, start)));
    }
  }

  const { min, max } = goalLimits(shown);
  const inRange = draft >= min && draft <= max;

  return (
    <BottomSheet
      visible={metric !== null}
      onDismiss={onDismiss}
      reduceMotion={reduceMotion}
    >
      <Text style={[typography.title2, styles.title]}>{GOAL_LABELS[shown]}</Text>
      <Text style={[typography.subheadline, styles.subtitle]}>
        {inRange
          ? formatGoalValue(shown, draft)
          : `Pick between ${formatGoalValue(shown, min)} and ${formatGoalValue(shown, max)}`}
      </Text>

      {shown === 'distance' && (
        <View style={styles.presets}>
          {GOAL_DISTANCE_PRESETS.map((preset) => (
            <Chip
              key={preset.id}
              label={preset.label}
              selected={draft === preset.meters}
              onPress={() => setDraft(preset.meters)}
            />
          ))}
        </View>
      )}

      <View style={styles.wheels}>
        {shown === 'distance' && (
          <DistanceWheels meters={draft} onChange={setDraft} />
        )}
        {shown === 'time' && <TimeWheels seconds={draft} onChange={setDraft} />}
        {shown === 'pace' && <PaceWheels seconds={draft} onChange={setDraft} />}
      </View>

      <View style={styles.actions}>
        <Button
          label="Clear"
          variant="secondary"
          disabled={!canClear}
          onPress={() => onClear(shown)}
          style={styles.action}
        />
        <Button
          label="Set"
          variant="accent"
          disabled={!inRange}
          onPress={() => onSet(shown, draft)}
          style={styles.action}
        />
      </View>
    </BottomSheet>
  );
}

function DistanceWheels({
  meters,
  onChange,
}: {
  meters: number;
  onChange: (meters: number) => void;
}) {
  const km = Math.floor(meters / 1000);
  const tenth = Math.min(9, Math.round((meters - km * 1000) / 100));
  return (
    <>
      <View style={styles.wheel}>
        <WheelPicker
          items={KM_ITEMS}
          selectedValue={km}
          onValueChange={(next) => onChange(next * 1000 + tenth * 100)}
          accessibilityLabel="Kilometers"
        />
      </View>
      <View style={styles.wheel}>
        <WheelPicker
          items={TENTH_ITEMS}
          selectedValue={tenth}
          onValueChange={(next) => onChange(km * 1000 + next * 100)}
          accessibilityLabel="Tenths of a kilometer"
        />
      </View>
    </>
  );
}

function TimeWheels({
  seconds,
  onChange,
}: {
  seconds: number;
  onChange: (seconds: number) => void;
}) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return (
    <>
      <View style={styles.wheel}>
        <WheelPicker
          items={HOUR_ITEMS}
          selectedValue={hours}
          onValueChange={(next) => onChange(next * 3600 + minutes * 60)}
          accessibilityLabel="Hours"
        />
      </View>
      <View style={styles.wheel}>
        <WheelPicker
          items={MINUTE_ITEMS}
          selectedValue={minutes}
          onValueChange={(next) => onChange(hours * 3600 + next * 60)}
          accessibilityLabel="Minutes"
        />
      </View>
    </>
  );
}

function PaceWheels({
  seconds,
  onChange,
}: {
  seconds: number;
  onChange: (seconds: number) => void;
}) {
  const minutes = Math.min(
    PACE_MAX_MINUTES,
    Math.max(PACE_MIN_MINUTES, Math.floor(seconds / 60)),
  );
  const secs = (Math.round((seconds % 60) / GOAL_PACE_STEP_S) * GOAL_PACE_STEP_S) % 60;
  return (
    <>
      <View style={styles.wheel}>
        <WheelPicker
          items={PACE_MINUTE_ITEMS}
          selectedValue={minutes}
          onValueChange={(next) => onChange(next * 60 + secs)}
          accessibilityLabel="Pace minutes per kilometer"
        />
      </View>
      <View style={styles.wheel}>
        <WheelPicker
          items={PACE_SECOND_ITEMS}
          selectedValue={secs}
          onValueChange={(next) => onChange(minutes * 60 + next)}
          accessibilityLabel="Pace seconds per kilometer"
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.textPrimary,
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xxs,
    marginBottom: spacing.md,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  wheels: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  wheel: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  action: {
    flex: 1,
  },
});
