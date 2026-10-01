import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import type { RunViewProps } from '../run/types';
import { colors, spacing, typography } from '../theme';
import { formatClock } from '../utils/format';
import Button from './Button';

/**
 * Quick start run screen: distance, time, pace and calories with the
 * Pause / Resume and Finish controls. The ActiveRun shell owns the tracking.
 */
export default function BasicRunView({
  runState,
  distanceKm,
  durationSeconds,
  paceLabel,
  calories,
  themeAnim,
  onPause,
  onResume,
  onFinish,
}: RunViewProps) {
  const textColor = themeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.textPrimary, colors.runDarkText],
  });

  const secondaryTextColor = themeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.textSecondary, colors.runDarkTextSecondary],
  });

  return (
    <View style={styles.content}>
      <Animated.Text style={[typography.headline, { color: textColor }]}>
        {runState === 'paused' ? 'Paused' : 'Active Run'}
      </Animated.Text>

      <View style={styles.metricsContainer}>
        <View style={styles.mainMetric}>
          <Animated.Text style={[styles.distanceText, { color: textColor }]}>
            {distanceKm.toFixed(2)}
          </Animated.Text>
          <Animated.Text style={[typography.body, { color: secondaryTextColor }]}>
            Kilometers
          </Animated.Text>
        </View>

        <View style={styles.mainMetric}>
          <Animated.Text style={[styles.timeText, { color: textColor }]}>
            {formatClock(durationSeconds)}
          </Animated.Text>
        </View>

        <View style={styles.secondaryMetricsRow}>
          <View style={styles.secondaryMetric}>
            <View style={styles.paceValueRow}>
              <Animated.Text
                style={[typography.title2, styles.metricValue, { color: textColor }]}
              >
                {paceLabel}
              </Animated.Text>
              <Animated.Text style={[typography.subheadline, { color: secondaryTextColor }]}>
                /km
              </Animated.Text>
            </View>
            <Animated.Text style={[typography.subheadline, { color: secondaryTextColor }]}>
              Pace
            </Animated.Text>
          </View>

          <View style={styles.secondaryMetric}>
            <Animated.Text style={[typography.title2, styles.metricValue, { color: textColor }]}>
              {calories}
            </Animated.Text>
            <Animated.Text style={[typography.subheadline, { color: secondaryTextColor }]}>
              Calories
            </Animated.Text>
          </View>
        </View>
      </View>

      <View style={styles.controlsRow}>
        {runState === 'paused' ? (
          <Button
            label="Resume"
            variant="runPause"
            appearanceAnim={themeAnim}
            onPress={onResume}
            style={styles.controlButton}
          />
        ) : (
          <Button
            label="Pause"
            variant="runPause"
            appearanceAnim={themeAnim}
            onPress={onPause}
            style={styles.controlButton}
          />
        )}

        <Button
          label="Finish"
          variant="runFinish"
          appearanceAnim={themeAnim}
          onPress={onFinish}
          style={styles.controlButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: spacing.xl,
  },
  mainMetric: {
    alignItems: 'center',
  },
  distanceText: {
    fontSize: 84,
    fontWeight: '800',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  timeText: {
    fontSize: 56,
    fontWeight: '700',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  secondaryMetricsRow: {
    flexDirection: 'row',
    gap: spacing.xxl,
    marginTop: spacing.md,
  },
  secondaryMetric: {
    alignItems: 'center',
    minWidth: 80,
  },
  paceValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xxs,
  },
  metricValue: {
    fontVariant: ['tabular-nums'],
  },
  controlsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
    alignItems: 'center',
  },
  controlButton: {
    flex: 1,
  },
});
