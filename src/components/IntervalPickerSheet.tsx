import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatDistanceShort } from '../coach/plan';
import {
  REPS_MAX,
  REPS_MIN,
  REST_MAX_S,
  REST_MIN_S,
  REST_STEP_S,
  SETS_MAX,
  SETS_MIN,
  SET_REST_MAX_S,
  SET_REST_MIN_S,
  SET_REST_STEP_S,
  WARMUP_MAX_MINUTES,
  WARMUP_MIN_MINUTES,
  WORK_DISTANCES_M,
  WORK_TIME_MAX_S,
  WORK_TIME_MIN_S,
  WORK_TIME_STEP_S,
} from '../run/intervalConfig';
import { formatSeconds } from '../run/intervalSetup';
import { colors, spacing, typography } from '../theme';
import BottomSheet from './BottomSheet';
import Button from './Button';
import Chip from './Chip';
import WheelPicker, { type WheelItem } from './WheelPicker';

/** What the sheet edits. */
export type IntervalPickerKind =
  | 'workDistance'
  | 'workTime'
  | 'reps'
  | 'sets'
  | 'rest'
  | 'setRest'
  | 'warmup'
  | 'cooldown';

type Limits = { min: number; max: number; step: number };

/** Amounts in seconds, picked with minute and second wheels. */
const TIME_LIMITS: Partial<Record<IntervalPickerKind, Limits>> = {
  workTime: { min: WORK_TIME_MIN_S, max: WORK_TIME_MAX_S, step: WORK_TIME_STEP_S },
  rest: { min: REST_MIN_S, max: REST_MAX_S, step: REST_STEP_S },
  setRest: { min: SET_REST_MIN_S, max: SET_REST_MAX_S, step: SET_REST_STEP_S },
};

const TITLES: Record<IntervalPickerKind, string> = {
  workDistance: 'Work distance',
  workTime: 'Work time',
  reps: 'Reps',
  sets: 'Sets',
  rest: 'Rest between reps',
  setRest: 'Rest between sets',
  warmup: 'Warm-up',
  cooldown: 'Cool-down',
};

const range = (from: number, to: number, step = 1) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
const numberItems = (from: number, to: number): WheelItem<number>[] =>
  range(from, to).map((n) => ({ value: n, label: String(n) }));

const DISTANCE_ITEMS: WheelItem<number>[] = WORK_DISTANCES_M.map((m) => ({
  value: m,
  label: formatDistanceShort(m),
}));
const REP_ITEMS = numberItems(REPS_MIN, REPS_MAX);
const SET_ITEMS = numberItems(SETS_MIN, SETS_MAX);
const MINUTE_ITEMS = numberItems(WARMUP_MIN_MINUTES, WARMUP_MAX_MINUTES);

function minuteItems(max: number): WheelItem<number>[] {
  return range(0, Math.floor(max / 60)).map((n) => ({ value: n, label: `${n} min` }));
}
function secondItems(step: number): WheelItem<number>[] {
  return range(0, 60 - step, step).map((n) => ({ value: n, label: `${n} s` }));
}

function nearestItem(items: WheelItem<number>[], value: number) {
  return items.reduce(
    (best, item) => (Math.abs(item.value - value) < Math.abs(best - value) ? item.value : best),
    items[0].value,
  );
}

type Props = {
  /** What is being edited; `null` keeps the sheet closed. */
  kind: IntervalPickerKind | null;
  /** The current value: meters, seconds, a count or minutes, by `kind`. */
  value: number;
  /** For the rests: whether it ends when the runner taps Ready. */
  manual?: boolean;
  onSet: (kind: IntervalPickerKind, value: number, manual: boolean) => void;
  onDismiss: () => void;
  reduceMotion?: boolean;
};

/**
 * Bottom sheet with wheels to pick one value of the interval setup: a work
 * amount, reps, sets, a rest or the warm-up. The rests also offer "Until
 * I'm ready". Same pattern as `GoalPickerSheet`.
 */
export default function IntervalPickerSheet({
  kind,
  value,
  manual = false,
  onSet,
  onDismiss,
  reduceMotion,
}: Props) {
  // Kept while the sheet animates out, so its content doesn't vanish.
  const [shown, setShown] = useState<IntervalPickerKind>(kind ?? 'reps');
  const [draft, setDraft] = useState(value);
  const [draftManual, setDraftManual] = useState(false);
  const [openedFor, setOpenedFor] = useState<IntervalPickerKind | null>(null);

  // Reset the draft while rendering the opening frame, so the wheels mount
  // on the right rows instead of scrolling there.
  if (kind !== openedFor) {
    setOpenedFor(kind);
    if (kind) {
      setShown(kind);
      setDraftManual(manual);
      setDraft(startValue(kind, value));
    }
  }

  const isRest = shown === 'rest' || shown === 'setRest';
  const limits = TIME_LIMITS[shown];
  const inRange = limits ? draft >= limits.min && draft <= limits.max : true;
  const subtitle = draftManual
    ? 'Ends when you tap Ready'
    : !inRange && limits
      ? `Pick between ${formatSeconds(limits.min)} and ${formatSeconds(limits.max)}`
      : describe(shown, draft);

  return (
    <BottomSheet visible={kind !== null} onDismiss={onDismiss} reduceMotion={reduceMotion}>
      <Text style={[typography.title2, styles.title]}>{TITLES[shown]}</Text>
      <Text style={[typography.subheadline, styles.subtitle]}>{subtitle}</Text>

      {isRest && (
        <View style={styles.presets}>
          <Chip
            label="Until I'm ready"
            selected={draftManual}
            onPress={() => setDraftManual((current) => !current)}
          />
        </View>
      )}

      <View style={[styles.wheels, draftManual && styles.wheelsOff]} pointerEvents={draftManual ? 'none' : 'auto'}>
        {shown === 'workDistance' && (
          <Wheel items={DISTANCE_ITEMS} value={draft} onChange={setDraft} label="Distance" />
        )}
        {shown === 'reps' && (
          <Wheel items={REP_ITEMS} value={draft} onChange={setDraft} label="Reps" unit="reps" />
        )}
        {shown === 'sets' && (
          <Wheel items={SET_ITEMS} value={draft} onChange={setDraft} label="Sets" unit="sets" />
        )}
        {(shown === 'warmup' || shown === 'cooldown') && (
          <Wheel items={MINUTE_ITEMS} value={draft} onChange={setDraft} label="Minutes" />
        )}
        {limits && (
          <TimeWheels seconds={draft} limits={limits} onChange={setDraft} />
        )}
      </View>

      <Button
        label="Set"
        variant="accent"
        disabled={!draftManual && !inRange}
        onPress={() => onSet(shown, draft, draftManual)}
      />
    </BottomSheet>
  );
}

/** The wheels show whole rows: open on the nearest one. */
function startValue(kind: IntervalPickerKind, value: number) {
  switch (kind) {
    case 'workDistance':
      return nearestItem(DISTANCE_ITEMS, value);
    case 'reps':
      return Math.min(REPS_MAX, Math.max(REPS_MIN, Math.round(value)));
    case 'sets':
      return Math.min(SETS_MAX, Math.max(SETS_MIN, Math.round(value)));
    case 'warmup':
    case 'cooldown':
      return Math.min(WARMUP_MAX_MINUTES, Math.max(WARMUP_MIN_MINUTES, Math.round(value)));
    default: {
      const limits = TIME_LIMITS[kind];
      if (!limits) return value;
      const snapped = Math.round(value / limits.step) * limits.step;
      return Math.min(limits.max, Math.max(limits.min, snapped));
    }
  }
}

function describe(kind: IntervalPickerKind, value: number) {
  switch (kind) {
    case 'workDistance':
      return formatDistanceShort(value);
    case 'reps':
      return value === 1 ? '1 rep' : `${value} reps`;
    case 'sets':
      return value === 1 ? '1 set' : `${value} sets`;
    case 'warmup':
    case 'cooldown':
      return `${value} min`;
    default:
      return formatSeconds(value);
  }
}

function Wheel({
  items,
  value,
  onChange,
  label,
  unit,
}: {
  items: WheelItem<number>[];
  value: number;
  onChange: (value: number) => void;
  label: string;
  unit?: string;
}) {
  return (
    <View style={styles.wheel}>
      <WheelPicker
        items={items}
        selectedValue={value}
        onValueChange={onChange}
        unitLabel={unit}
        accessibilityLabel={label}
      />
    </View>
  );
}

function TimeWheels({
  seconds,
  limits,
  onChange,
}: {
  seconds: number;
  limits: Limits;
  onChange: (seconds: number) => void;
}) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  // Stable arrays: the wheels keep their position while the draft changes.
  const minuteWheel = useMemo(() => minuteItems(limits.max), [limits.max]);
  const secondWheel = useMemo(() => secondItems(limits.step), [limits.step]);
  return (
    <>
      <Wheel
        items={minuteWheel}
        value={minutes}
        onChange={(next) => onChange(next * 60 + secs)}
        label="Minutes"
      />
      <Wheel
        items={secondWheel}
        value={secs}
        onChange={(next) => onChange(minutes * 60 + next)}
        label="Seconds"
      />
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
  wheelsOff: {
    opacity: 0.35,
  },
  wheel: {
    flex: 1,
  },
});
