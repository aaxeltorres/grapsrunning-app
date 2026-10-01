import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  GOAL_LABELS,
  formatGoalValue,
  goalLimits,
  type GoalMetric,
} from '../run/goals';
import { GOAL_DISTANCE_PRESETS } from '../run/goalConfig';
import { lightImpact } from '../utils/haptics';
import { colors, radius, spacing, typography } from '../theme';
import BottomSheet from './BottomSheet';
import Button from './Button';
import WheelPicker, { type WheelItem } from './WheelPicker';

const range = (from: number, to: number, step = 1) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

const KM_ITEMS: WheelItem<number>[] = range(0, 100).map((n) => ({
  value: n,
  label: String(n),
}));
const TENTH_ITEMS: WheelItem<number>[] = range(0, 9).map((n) => ({
  value: n,
  label: `.${n} km`,
}));
const HOUR_ITEMS: WheelItem<number>[] = range(0, 10).map((n) => ({
  value: n,
  label: `${n} h`,
}));
const MINUTE_ITEMS: WheelItem<number>[] = range(0, 59).map((n) => ({
  value: n,
  label: `${n} min`,
}));
const PACE_MINUTE_ITEMS: WheelItem<number>[] = range(2, 15).map((n) => ({
  value: n,
  label: String(n),
}));
const PACE_SECOND_ITEMS: WheelItem<number>[] = range(0, 55, 5).map((n) => ({
  value: n,
  label: `:${n.toString().padStart(2, '0')} /km`,
}));

/** Starting point of a goal that isn't set yet. */
const DEFAULT_VALUES: Record<GoalMetric, number> = {
  distance: 5000,
  time: 30 * 60,
  pace: 6 * 60,
};

/** Wheels show whole steps; snap a value onto them. */
function snap(metric: GoalMetric, value: number) {
  if (metric === 'pace') return Math.round(value / 5) * 5;
  if (metric === 'time') return Math.round(value / 60) * 60;
  return value; // distance keeps exact presets such as the half marathon
}

type Props = {
  /** The goal being edited; `null` keeps the sheet closed. */
  metric: GoalMetric | null;
  /** The current goal, or a suggestion (e.g. the derived value). */
  initialValue?: number;
  onSet: (metric: GoalMetric, value: number) => void;
  onClear: (metric: GoalMetric) => void;
  onDismiss: () => void;
  reduceMotion?: boolean;
};

/** Bottom sheet with wheels to pick one goal: distance, time or pace. */
export default function GoalPickerSheet({
  metric,
  initialValue,
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
      setDraft(snap(metric, initialValue ?? DEFAULT_VALUES[metric]));
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
          {GOAL_DISTANCE_PRESETS.map((preset) => {
            const selected = draft === preset.meters;
            return (
              <Pressable
                key={preset.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  lightImpact();
                  setDraft(preset.meters);
                }}
                style={({ pressed }) => [
                  styles.chip,
                  selected && styles.chipSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    typography.subheadline,
                    styles.chipLabel,
                    selected && styles.chipLabelSelected,
                  ]}
                >
                  {preset.label}
                </Text>
              </Pressable>
            );
          })}
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
  const minutes = Math.min(15, Math.max(2, Math.floor(seconds / 60)));
  const secs = Math.round((seconds % 60) / 5) * 5 % 60;
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
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceGray,
  },
  chipSelected: {
    backgroundColor: colors.iosBlue,
  },
  chipLabel: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  chipLabelSelected: {
    color: colors.white,
  },
  pressed: {
    opacity: 0.85,
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
