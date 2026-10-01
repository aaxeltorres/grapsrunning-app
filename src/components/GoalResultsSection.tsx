import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  GOAL_LABELS,
  formatGoalValue,
  goalResults,
  type GoalResult,
  type RunGoal,
} from '../run/goals';
import { colors, radius, spacing, typography } from '../theme';

type Props = {
  goal: RunGoal;
  distanceKm: number;
  durationSeconds: number;
};

/**
 * Self-contained "Goals" section for a finished run: one row per goal
 * that was set, with the target, what was run, and met or missed.
 * Renders nothing when no goal was set.
 */
export default function GoalResultsSection({
  goal,
  distanceKm,
  durationSeconds,
}: Props) {
  const results = goalResults(goal, distanceKm, durationSeconds);
  if (results.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={[typography.headline, styles.title]}>Goals</Text>
      {results.map((result) => (
        <ResultRow key={result.metric} result={result} />
      ))}
    </View>
  );
}

function ResultRow({ result }: { result: GoalResult }) {
  const { metric, target, actual, met } = result;
  const actualLabel =
    actual === null
      ? '--'
      : metric === 'distance'
        ? `${(actual / 1000).toFixed(2)} km` // 4.98 must not read as 5 km
        : formatGoalValue(metric, actual);
  const targetLabel = formatGoalValue(metric, target);
  const status = met ? 'Met' : 'Missed';

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${GOAL_LABELS[metric]} goal ${targetLabel}: ${actualLabel}, ${status.toLowerCase()}`}
    >
      <View style={styles.rowText}>
        <Text style={[typography.subheadline, styles.label]}>
          {GOAL_LABELS[metric]}
        </Text>
        <Text style={[typography.headline, styles.value]}>
          {actualLabel}
          <Text style={[typography.subheadline, styles.label]}>
            {`  / ${targetLabel}`}
          </Text>
        </Text>
      </View>
      <View style={[styles.pill, met ? styles.metPill : styles.missedPill]}>
        <Text
          style={[
            typography.caption,
            styles.pillText,
            met ? styles.metText : styles.missedText,
          ]}
        >
          {met ? 'Met ✓' : status}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    backgroundColor: colors.surfaceGray,
    gap: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowText: {
    flex: 1,
  },
  label: {
    color: colors.textSecondary,
  },
  value: {
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  metPill: {
    backgroundColor: colors.statGreenBg,
  },
  missedPill: {
    backgroundColor: colors.divider,
  },
  pillText: {
    fontWeight: '600',
  },
  metText: {
    color: colors.textPrimary,
  },
  missedText: {
    color: colors.textSecondary,
  },
});
