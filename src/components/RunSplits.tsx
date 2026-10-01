import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  fastestSplitIndex,
  splitBarFraction,
  splitPace,
  type Split,
} from '../run/splits';
import { formatPaceSeconds } from '../utils/format';
import { colors, radius, spacing, typography } from '../theme';

type Props = {
  splits: Split[];
};

const BAR_HEIGHT = 8;

/**
 * Per-kilometer splits: km, a bar proportional to speed (plain Views) and
 * the pace. The fastest full kilometer is highlighted. Renders nothing
 * when there is no complete kilometer.
 */
export default function RunSplits({ splits }: Props) {
  const full = splits.filter((split) => !split.partial);
  if (full.length === 0) return null;

  const fastestIndex = fastestSplitIndex(splits);
  const fastestPace = Math.min(...full.map(splitPace));

  return (
    <View>
      <View style={styles.header}>
        <Text style={[typography.title2, styles.title]}>Splits</Text>
        <Text style={[typography.caption, styles.columnLabel]}>PACE /KM</Text>
      </View>
      {splits.map((split, i) => {
        const pace = splitPace(split);
        const isFastest = split.index === fastestIndex;
        const paceLabel = formatPaceSeconds(pace);
        const distanceLabel = split.partial
          ? `${split.distanceKm.toFixed(2)} km`
          : `kilometer ${split.index}`;
        return (
          <View
            key={split.index}
            style={[styles.row, i > 0 && styles.rowDivider]}
            accessible
            accessibilityLabel={`${distanceLabel}, ${paceLabel} per kilometer${
              isFastest ? ', fastest' : ''
            }`}
          >
            <Text style={[typography.subheadline, styles.km]}>
              {split.partial ? split.distanceKm.toFixed(2) : split.index}
            </Text>
            <View style={styles.barArea}>
              <View
                style={[
                  styles.bar,
                  { width: `${splitBarFraction(pace, fastestPace) * 100}%` },
                  isFastest && styles.barFastest,
                ]}
              />
            </View>
            <Text
              style={[typography.headline, styles.pace, isFastest && styles.paceFastest]}
            >
              {paceLabel}
            </Text>
          </View>
        );
      })}
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
  km: {
    width: 36,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  barArea: {
    flex: 1,
  },
  bar: {
    height: BAR_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: colors.progressTrack,
  },
  barFastest: {
    backgroundColor: colors.iosBlue,
  },
  pace: {
    width: 56,
    textAlign: 'right',
    color: colors.textSecondary,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  paceFastest: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
