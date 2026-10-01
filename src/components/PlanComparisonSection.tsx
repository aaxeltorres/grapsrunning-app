import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { displayName, type Workout } from '../coach/plan';
import { plannedVsActual, type ComparisonRow } from '../run/planResult';
import { colors, radius, spacing, typography } from '../theme';

type Props = {
  workout: Workout;
  distanceKm: number;
  durationSeconds: number;
  /** The workout was cut short: finished early or with skipped segments. */
  partial: boolean;
};

/**
 * "Planned vs actual" block of Run results for a plan workout run: one row
 * per number with the plan, what was run and the difference.
 */
export default function PlanComparisonSection({
  workout,
  distanceKm,
  durationSeconds,
  partial,
}: Props) {
  const rows = plannedVsActual(workout, {
    distanceMeters: distanceKm * 1000,
    durationSeconds,
  });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[typography.headline, styles.title]}>Planned vs actual</Text>
          <Text style={[typography.subheadline, styles.label]}>
            {displayName(workout)}
          </Text>
        </View>
        <View style={[styles.pill, partial ? styles.partialPill : styles.donePill]}>
          <Text style={[typography.caption, styles.pillText]}>
            {partial ? 'Partial' : 'Completed ✓'}
          </Text>
        </View>
      </View>

      <View style={styles.columns} importantForAccessibility="no-hide-descendants">
        <Text style={[typography.caption, styles.columnLabel, styles.rowLabel]} />
        <Text style={[typography.caption, styles.columnLabel, styles.value]}>Planned</Text>
        <Text style={[typography.caption, styles.columnLabel, styles.value]}>Actual</Text>
      </View>

      {rows.map((row, index) => (
        <Row key={row.key} row={row} showDivider={index > 0} />
      ))}
    </View>
  );
}

function Row({ row, showDivider }: { row: ComparisonRow; showDivider: boolean }) {
  const { label, planned, actual, delta } = row;
  return (
    <View
      style={[styles.rowWrap, showDivider && styles.rowDivider]}
      accessible
      accessibilityLabel={`${label}. Planned ${planned}. Actual ${actual}.${
        delta ? ` ${delta}.` : ''
      }`}
    >
      <View style={styles.row}>
        <Text style={[typography.subheadline, styles.label, styles.rowLabel]}>
          {label}
        </Text>
        <Text style={[typography.headline, styles.plannedValue, styles.value]}>
          {planned}
        </Text>
        <Text style={[typography.headline, styles.actualValue, styles.value]}>
          {actual}
        </Text>
      </View>
      {delta !== null && (
        <Text style={[typography.caption, styles.delta]}>{delta}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    backgroundColor: colors.surfaceGray,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xxs,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
  },
  label: {
    color: colors.textSecondary,
  },
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  donePill: {
    backgroundColor: colors.statGreenBg,
  },
  partialPill: {
    backgroundColor: colors.divider,
  },
  pillText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  columnLabel: {
    color: colors.textMuted,
  },
  rowWrap: {
    gap: 2,
    paddingTop: spacing.xs,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowLabel: {
    flex: 1.2,
  },
  value: {
    flex: 1,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  plannedValue: {
    color: colors.textSecondary,
    fontWeight: '400',
  },
  actualValue: {
    color: colors.textPrimary,
  },
  delta: {
    textAlign: 'right',
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
});
