import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  displayName,
  keyPace,
  segmentBarParts,
  totalDistance,
  totalDuration,
  typeLabel,
  type Pace,
  type Workout,
  type WorkoutType,
} from '../coach/plan';
import { formatDayLabel, type ISODate } from '../utils/dates';
import { formatPaceSeconds } from '../utils/format';
import { colors, radius, spacing, typography } from '../theme';
import Button from './Button';

const BAR_HEIGHT = 8;
const BAR_GAP = 3;

/** Workout type colors: calendar dots, legend and the segment bar. */
export const WORKOUT_TYPE_COLORS: Record<
  Exclude<WorkoutType, 'rest'>,
  string
> = {
  easy: colors.workoutEasy,
  intervals: colors.workoutIntervals,
  long: colors.workoutLong,
};

/** "5.0 km" */
export function formatKm(meters: number) {
  return `${(meters / 1000).toFixed(1)} km`;
}

/** "35 min", "1 h 05 min" */
export function formatMinutes(seconds: number) {
  const total = Math.round(seconds / 60);
  if (total < 60) return `${total} min`;
  const rest = (total % 60).toString().padStart(2, '0');
  return `${Math.floor(total / 60)} h ${rest} min`;
}

/** "5:10" or "6:05–6:35" */
export function formatPace(pace: Pace) {
  return typeof pace === 'number'
    ? formatPaceSeconds(pace)
    : `${formatPaceSeconds(pace.min)}–${formatPaceSeconds(pace.max)}`;
}

/** Whether the workout's name already says its type ("Long run"). */
function nameIncludesType(workout: Workout) {
  return displayName(workout)
    .toLowerCase()
    .includes(typeLabel(workout.type).toLowerCase());
}

/** "Today · intervals", "Fri 2"; the type only when the name lacks it. */
function dayHeading(date: ISODate, today: ISODate, workout?: Workout) {
  const day = date === today ? 'Today' : formatDayLabel(date);
  return workout && !nameIncludesType(workout)
    ? `${day} · ${typeLabel(workout.type).toLowerCase()}`
    : day;
}

type Props = {
  date: ISODate;
  today: ISODate;
  /** `undefined` when the day is outside the plan. */
  workout?: Workout;
  onStart?: () => void;
  /** Opens the editor. Left out when the workout can't be edited. */
  onEdit?: () => void;
};

/**
 * The selected day's workout: name, key numbers, a proportional segment
 * bar and actions. Also covers rest, completed and empty days.
 */
export default function WorkoutCard({
  date,
  today,
  workout,
  onStart,
  onEdit,
}: Props) {
  const heading = dayHeading(date, today, workout);

  if (!workout || workout.type === 'rest') {
    return (
      <View style={[styles.card, styles.quietCard]}>
        <Text style={[typography.subheadline, styles.quietHeading]}>
          {heading}
        </Text>
        <Text style={[typography.title2, styles.title]}>
          {workout ? 'Rest day' : 'No workout planned'}
        </Text>
        <Text style={[typography.body, styles.quietBody]}>
          {workout
            ? 'No run today. A walk or some gentle stretching is perfect.'
            : 'This day is outside your current plan.'}
        </Text>
      </View>
    );
  }

  const pace = keyPace(workout);
  const isDone = workout.status === 'completed';
  const isSkipped = workout.status === 'skipped';

  return (
    <View style={[styles.card, styles.workoutCard]}>
      <View style={styles.headingRow}>
        <Text style={[typography.subheadline, styles.heading]}>{heading}</Text>
        {(isDone || isSkipped) && (
          <View
            style={[
              styles.statusPill,
              isDone ? styles.donePill : styles.skippedPill,
            ]}
          >
            <Text style={[typography.caption, styles.statusText]}>
              {isDone ? 'Completed ✓' : 'Skipped'}
            </Text>
          </View>
        )}
        {!isDone && !isSkipped && workout.edited && (
          <View style={[styles.statusPill, styles.editedPill]}>
            <Text style={[typography.caption, styles.statusText]}>Edited</Text>
          </View>
        )}
      </View>
      <Text style={[typography.largeTitle, styles.title]}>
        {displayName(workout)}
      </Text>

      <View style={styles.metrics}>
        <Metric value={formatKm(totalDistance(workout))} label="distance" />
        <Metric value={formatMinutes(totalDuration(workout))} label="time" />
        {pace !== null && (
          <Metric
            value={formatPace(pace)}
            label={workout.type === 'intervals' ? 'fast pace /km' : 'pace /km'}
          />
        )}
      </View>

      <SegmentBar workout={workout} />

      {!isDone && (
        <View style={styles.actions}>
          <Button
            label="Start workout"
            variant="accent"
            onPress={onStart}
            leftAdornment={<View style={styles.playIcon} />}
            style={styles.startButton}
          />
          {onEdit && (
            <Button
              label="Edit"
              variant="outline"
              onPress={onEdit}
              style={styles.editButton}
            />
          )}
        </View>
      )}
    </View>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View
      style={styles.metric}
      accessible
      accessibilityLabel={`${label.replace(' /km', ' per kilometer')}: ${value}`}
    >
      <Text style={[typography.title2, styles.metricValue]}>{value}</Text>
      <Text style={[typography.subheadline, styles.metricLabel]}>{label}</Text>
    </View>
  );
}

/** Warm-up / main / cool-down, sized by duration. */
function SegmentBar({ workout }: { workout: Workout }) {
  const parts = segmentBarParts(workout);
  if (parts.length === 0 || workout.type === 'rest') return null;
  const mainColor = WORKOUT_TYPE_COLORS[workout.type];
  const lastIndex = parts.length - 1;

  return (
    <View
      style={styles.bar}
      accessible
      accessibilityLabel={parts.map((part) => part.label).join(', ')}
    >
      <View style={styles.barTrack}>
        {parts.map((part) => (
          <View
            key={part.kind}
            style={[
              styles.barPart,
              {
                flex: part.fraction,
                backgroundColor:
                  part.kind === 'main' ? mainColor : colors.planSegmentMuted,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.barLabels}>
        {parts.map((part, index) => (
          <Text
            key={part.kind}
            numberOfLines={1}
            style={[
              typography.caption,
              styles.barLabel,
              lastIndex > 0 && index === lastIndex && styles.barLabelEnd,
              lastIndex === 2 && index === 1 && styles.barLabelCenter,
            ]}
          >
            {part.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

type SummaryProps = {
  date: ISODate;
  today: ISODate;
  workout?: Workout;
  onPress?: () => void;
};

/** Compact summary under the month calendar. Tapping opens the day. */
export function WorkoutSummaryCard({
  date,
  today,
  workout,
  onPress,
}: SummaryProps) {
  const isTraining = workout !== undefined && workout.type !== 'rest';
  const title = !workout
    ? 'No workout planned'
    : !isTraining
      ? 'Rest day'
      : nameIncludesType(workout)
        ? displayName(workout)
        : `${typeLabel(workout.type)} · ${displayName(workout)}`;
  const heading =
    date === today ? `${formatDayLabel(date)} · today` : formatDayLabel(date);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Shows this day in the week view"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        isTraining ? styles.workoutCard : styles.quietCard,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          typography.subheadline,
          isTraining ? styles.heading : styles.quietHeading,
        ]}
      >
        {heading}
      </Text>
      <Text style={[typography.headline, styles.title]}>{title}</Text>
      {isTraining && (
        <Text style={[typography.subheadline, styles.metricLabel]}>
          {`${formatKm(totalDistance(workout))} · ${formatMinutes(
            totalDuration(workout),
          )}`}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xxs,
  },
  workoutCard: {
    backgroundColor: colors.cardPlanBg,
  },
  quietCard: {
    backgroundColor: colors.surfaceGray,
  },
  pressed: {
    opacity: 0.85,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  heading: {
    color: colors.planCardAccent,
    fontWeight: '600',
  },
  quietHeading: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  title: {
    color: colors.textPrimary,
  },
  quietBody: {
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  statusPill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  donePill: {
    backgroundColor: colors.statGreenBg,
  },
  skippedPill: {
    backgroundColor: colors.surfaceGray,
  },
  editedPill: {
    backgroundColor: colors.planSegmentMuted,
  },
  statusText: {
    color: colors.textPrimary,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.lg,
    rowGap: spacing.xs,
    marginTop: spacing.sm,
  },
  metric: {
    minWidth: 72,
  },
  metricValue: {
    color: colors.textPrimary,
  },
  metricLabel: {
    color: colors.textSecondary,
  },
  bar: {
    marginTop: spacing.md,
    gap: spacing.xxs,
  },
  barTrack: {
    flexDirection: 'row',
    gap: BAR_GAP,
    height: BAR_HEIGHT,
  },
  barPart: {
    borderRadius: BAR_HEIGHT / 2,
  },
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  barLabel: {
    flexShrink: 1,
    color: colors.textSecondary,
  },
  barLabelCenter: {
    textAlign: 'center',
  },
  barLabelEnd: {
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  // Start takes the remaining width so its label stays on one line.
  startButton: {
    flex: 1,
  },
  editButton: {
    paddingHorizontal: spacing.xl,
  },
  // Drawn as a triangle so no icon set is needed (as on Home).
  playIcon: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftColor: colors.white,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
});
