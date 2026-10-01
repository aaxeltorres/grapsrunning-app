import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RepResult } from '../coach/plan';
import { repRows } from '../run/repResults';
import { colors, spacing, typography } from '../theme';

type Props = {
  reps: RepResult[];
};

/**
 * "Reps" on Run results: one row per work step, in the splits list style.
 * A rep GPS could measure shows its pace against the target range; a short
 * effort (a 15 s stride, a 20 m sprint) shows its time. Renders nothing
 * without reps.
 */
export default function RepResultsSection({ reps }: Props) {
  const rows = repRows(reps);
  if (rows.length === 0) return null;

  return (
    <View>
      <View style={styles.header}>
        <Text style={[typography.title2, styles.title]}>Reps</Text>
        <Text style={[typography.caption, styles.columnLabel]}>VS TARGET</Text>
      </View>
      {rows.map((row, i) => (
        <View
          key={row.key}
          style={[styles.row, i > 0 && styles.rowDivider]}
          accessible
          accessibilityLabel={`${row.label}: ${row.value}${
            row.unit ? ' per kilometer' : ''
          }, target ${row.target}${row.verdict ? `, ${row.verdict}` : ''}`}
        >
          <View style={styles.labelCell}>
            <Text style={[typography.subheadline, styles.label]} numberOfLines={1}>
              {row.label}
            </Text>
            <Text style={[typography.caption, styles.target]} numberOfLines={1}>
              {`Target ${row.target}`}
            </Text>
          </View>
          <View style={styles.valueCell}>
            <Text style={[typography.headline, styles.value]}>
              {row.value}
              {row.unit !== '' && (
                <Text style={[typography.caption, styles.unit]}>{` ${row.unit}`}</Text>
              )}
            </Text>
            {row.verdict && (
              <Text
                style={[typography.caption, row.off ? styles.verdictOff : styles.verdict]}
                numberOfLines={1}
              >
                {row.verdict}
              </Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.textPrimary,
  },
  columnLabel: {
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  labelCell: {
    flex: 1,
  },
  label: {
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  target: {
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  valueCell: {
    alignItems: 'flex-end',
  },
  value: {
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    color: colors.textSecondary,
  },
  verdict: {
    color: colors.textSecondary,
  },
  verdictOff: {
    color: colors.planCardAccent,
  },
});
