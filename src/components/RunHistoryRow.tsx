import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { runTagLabel } from '../run/savedRun';
import type { SavedRun } from '../run/types';
import { colors, radius, spacing, typography } from '../theme';
import { formatRunRowDate, formatRunSheetDate } from '../utils/dates';
import {
  formatClock,
  formatPaceSeconds,
  formatSpokenDuration,
  PACE_PLACEHOLDER,
} from '../utils/format';

type Props = {
  run: SavedRun;
  onPress: (run: SavedRun) => void;
};

/**
 * One run in the history: when it was, how far, how long and how fast,
 * with a small tag for its mode or planned workout. Tapping opens it.
 */
function RunHistoryRow({ run, onPress }: Props) {
  const startedAt = Date.parse(run.startedAt);
  const tag = runTagLabel(run);
  const km = (run.distanceMeters / 1000).toFixed(2);
  const time = formatClock(run.movingDurationSec);
  const pace = formatPaceSeconds(run.avgPaceSecPerKm);
  const spokenPace =
    pace === PACE_PLACEHOLDER
      ? 'average pace not available'
      : `average pace ${pace} per kilometer`;
  const label = `${formatRunSheetDate(startedAt)}${tag ? `, ${tag}` : ''}. ${km} kilometers in ${formatSpokenDuration(run.movingDurationSec)}, ${spokenPace}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the run details"
      onPress={() => onPress(run)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.topLine} importantForAccessibility="no-hide-descendants">
        <Text style={[typography.subheadline, styles.date]}>
          {formatRunRowDate(startedAt)}
        </Text>
        {tag !== undefined && (
          <View style={[styles.tag, run.planned ? styles.planTag : styles.modeTag]}>
            <Text
              style={[typography.caption, run.planned ? styles.planTagText : styles.modeTagText]}
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
            >
              {tag}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.distanceLine} importantForAccessibility="no-hide-descendants">
        <Text style={[typography.title1, styles.distance]}>{km}</Text>
        <Text style={[typography.subheadline, styles.unit]}>km</Text>
      </View>

      <View style={styles.statsLine} importantForAccessibility="no-hide-descendants">
        <View style={styles.stat}>
          <Text style={[typography.headline, styles.statValue]}>{time}</Text>
          <Text style={[typography.caption, styles.statLabel]}>Time</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[typography.headline, styles.statValue]}>{pace}</Text>
          <Text style={[typography.caption, styles.statLabel]}>Avg pace /km</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default React.memo(RunHistoryRow);

const styles = StyleSheet.create({
  row: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceGray,
    padding: spacing.md,
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.6,
  },
  // Rows wrap at large text sizes instead of cutting the date or overflowing.
  topLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.xs,
    rowGap: spacing.xxs,
  },
  date: {
    flexShrink: 1,
    color: colors.textSecondary,
  },
  tag: {
    flexShrink: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  planTag: {
    backgroundColor: colors.cardPlanBg,
  },
  modeTag: {
    backgroundColor: colors.background,
  },
  planTagText: {
    color: colors.planCardAccent,
    fontWeight: '600',
  },
  modeTagText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  distanceLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xxs,
  },
  distance: {
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    color: colors.textSecondary,
  },
  statsLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.xl,
    rowGap: spacing.xs,
  },
  stat: {
    gap: 2,
  },
  statValue: {
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: colors.textMuted,
  },
});
