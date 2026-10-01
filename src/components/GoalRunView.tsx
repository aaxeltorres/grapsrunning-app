import React, { useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import type { RunViewProps } from '../run/types';
import {
  GOAL_LABELS,
  GOAL_METRICS,
  formatGoalValue,
  goalProgress,
  goalReached,
  goalValue,
  primaryMetric,
  type GoalMetric,
  type RunGoal,
} from '../run/goals';
import { PACE_TOLERANCE_S_PER_KM } from '../run/goalConfig';
import { useGoalAlerts } from '../hooks/useGoalAlerts';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors, radius, spacing, typography } from '../theme';
import { formatClock } from '../utils/format';
import AlertBlock from './AlertBlock';
import BasicRunView from './BasicRunView';
import Button from './Button';

const BAR_HEIGHT = 8;
/** The pace gauge spans the target pace plus or minus this, in s/km. */
const GAUGE_SPAN_S = 45;

type Themed = Animated.AnimatedInterpolation<string | number>;

/**
 * Goal run screen: the main goal big with its progress bar, the other
 * goals smaller with their own bars, and metrics without a goal smallest.
 * A goal that goes off track turns red with a soft pulse, silently.
 */
export default function GoalRunView(props: RunViewProps) {
  const { goal } = props;
  // Without a goal there is nothing to track: show the basic run.
  if (!goal || GOAL_METRICS.every((m) => goalValue(goal, m) === undefined)) {
    return <BasicRunView {...props} />;
  }
  return <GoalRun {...props} goal={goal} />;
}

function GoalRun({
  runState,
  distanceKm,
  durationSeconds,
  paceLabel,
  calories,
  themeAnim,
  goal,
  onPause,
  onResume,
  onFinish,
}: RunViewProps & { goal: RunGoal }) {
  const reduceMotion = useReduceMotion();
  const alerts = useGoalAlerts(goal, runState, distanceKm, durationSeconds);
  const [keepGoing, setKeepGoing] = useState(false);

  const theme = {
    text: themeAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [colors.textPrimary, colors.runDarkText],
    }),
    secondary: themeAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [colors.textSecondary, colors.runDarkTextSecondary],
    }),
    red: themeAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [colors.alertRedLight, colors.alertRedDark],
    }),
    track: themeAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [colors.progressTrack, colors.runDarkTrack],
    }),
  };

  const progress = goalProgress(goal, distanceKm, durationSeconds);
  const reached = goalReached(goal, distanceKm, durationSeconds);
  const primary = primaryMetric(goal);
  const goalMetrics = GOAL_METRICS.filter(
    (m) => goalValue(goal, m) !== undefined,
  );
  const secondaryGoals = goalMetrics.filter((m) => m !== primary);
  const freeMetrics = GOAL_METRICS.filter(
    (m) => goalValue(goal, m) === undefined,
  );

  const isAlert = (metric: GoalMetric) =>
    metric === 'pace' ? alerts.pace : metric === 'time' ? alerts.finish : false;

  const valueOf = (metric: GoalMetric) =>
    metric === 'distance'
      ? distanceKm.toFixed(2)
      : metric === 'time'
        ? formatClock(durationSeconds)
        : paceLabel;
  const unitOf = (metric: GoalMetric) =>
    metric === 'distance' ? 'km' : metric === 'pace' ? '/km' : '';

  const indicator = (metric: GoalMetric) => {
    if (metric === 'pace') {
      return (
        <PaceGauge
          target={goal.paceSecPerKm!}
          current={alerts.currentPace}
          alert={alerts.pace}
          theme={theme}
        />
      );
    }
    const value = metric === 'distance' ? progress.distance : progress.time;
    // The finishing goal completes the bar; a time budget only fills.
    const done = reached && (metric === primary || metric === 'distance');
    return <GoalBar progress={value ?? 0} done={done} theme={theme} />;
  };

  const targetLine = (metric: GoalMetric) =>
    `${metric === 'pace' ? 'Target' : 'of'} ${formatGoalValue(
      metric,
      goalValue(goal, metric)!,
    )}`;

  const showGoalChoice = reached && !keepGoing && runState === 'running';

  return (
    <View style={styles.content}>
      <Animated.Text style={[typography.headline, { color: theme.text }]}>
        {runState === 'paused' ? 'Paused' : 'Goal run'}
      </Animated.Text>

      <View style={styles.metrics}>
        <AlertBlock alert={isAlert(primary)} reduceMotion={reduceMotion} red={theme.red}>
          <View style={styles.primaryValueRow}>
            <Animated.Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.primaryValue,
                { color: isAlert(primary) ? theme.red : theme.text },
              ]}
            >
              {valueOf(primary)}
            </Animated.Text>
            {unitOf(primary) !== '' && (
              <Animated.Text style={[typography.title2, { color: theme.secondary }]}>
                {unitOf(primary)}
              </Animated.Text>
            )}
          </View>
          <Animated.Text style={[typography.subheadline, { color: theme.secondary }]}>
            {`${targetLine(primary)}${reached ? '  ✓' : ''}`}
          </Animated.Text>
          {indicator(primary)}
        </AlertBlock>

        {secondaryGoals.map((metric) => (
          <AlertBlock
            key={metric}
            alert={isAlert(metric)}
            reduceMotion={reduceMotion}
            red={theme.red}
          >
            <View style={styles.secondaryRow}>
              <Animated.Text style={[typography.subheadline, { color: theme.secondary }]}>
                {GOAL_LABELS[metric]}
              </Animated.Text>
              <Animated.Text style={[typography.subheadline, { color: theme.secondary }]}>
                {targetLine(metric)}
              </Animated.Text>
            </View>
            <Animated.Text
              style={[
                styles.secondaryValue,
                { color: isAlert(metric) ? theme.red : theme.text },
              ]}
            >
              {`${valueOf(metric)}${unitOf(metric) ? ` ${unitOf(metric)}` : ''}`}
            </Animated.Text>
            {indicator(metric)}
          </AlertBlock>
        ))}

        <View style={styles.freeRow}>
          {freeMetrics.map((metric) => (
            <SmallMetric
              key={metric}
              value={`${valueOf(metric)}${unitOf(metric) ? ` ${unitOf(metric)}` : ''}`}
              label={GOAL_LABELS[metric]}
              theme={theme}
            />
          ))}
          <SmallMetric value={String(calories)} label="Calories" theme={theme} />
        </View>
      </View>

      <View style={styles.controlsRow}>
        {showGoalChoice ? (
          <Button
            label="Keep going"
            variant="runPause"
            appearanceAnim={themeAnim}
            onPress={() => setKeepGoing(true)}
            style={styles.controlButton}
          />
        ) : runState === 'paused' ? (
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

type Theme = { text: Themed; secondary: Themed; red: Themed; track: Themed };

function GoalBar({
  progress,
  done,
  theme,
}: {
  progress: number;
  done: boolean;
  theme: Theme;
}) {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <Animated.View
      style={[styles.track, { backgroundColor: theme.track }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${clamped * 100}%`,
            backgroundColor: done ? colors.success : colors.iosBlue,
          },
        ]}
      />
    </Animated.View>
  );
}

/**
 * Where the current pace sits around the target: the band is the on-track
 * tolerance, faster to the right. No marker until the pace is known.
 */
function PaceGauge({
  target,
  current,
  alert,
  theme,
}: {
  target: number;
  current: number | null;
  alert: boolean;
  theme: Theme;
}) {
  const span = GAUGE_SPAN_S * 2;
  const bandWidth = (PACE_TOLERANCE_S_PER_KM * 2) / span;
  const position =
    current === null
      ? null
      : Math.max(0, Math.min(1, (target + GAUGE_SPAN_S - current) / span));

  return (
    <View style={styles.gauge}>
      <Animated.View style={[styles.track, { backgroundColor: theme.track }]}>
        <View
          style={[
            styles.band,
            {
              left: `${(0.5 - bandWidth / 2) * 100}%`,
              width: `${bandWidth * 100}%`,
            },
          ]}
        />
      </Animated.View>
      {position !== null && (
        <Animated.View
          style={[
            styles.marker,
            {
              left: `${position * 100}%`,
              backgroundColor: alert ? theme.red : theme.text,
            },
          ]}
        />
      )}
    </View>
  );
}

function SmallMetric({
  value,
  label,
  theme,
}: {
  value: string;
  label: string;
  theme: Theme;
}) {
  return (
    <View style={styles.smallMetric}>
      <Animated.Text style={[typography.headline, styles.tabular, { color: theme.text }]}>
        {value}
      </Animated.Text>
      <Animated.Text style={[typography.caption, { color: theme.secondary }]}>
        {label}
      </Animated.Text>
    </View>
  );
}

const MARKER_WIDTH = 4;
const MARKER_HEIGHT = 18;

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metrics: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    gap: spacing.md,
  },
  primaryValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  primaryValue: {
    flexShrink: 1,
    fontSize: 84,
    fontWeight: '800',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secondaryValue: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  freeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.sm,
  },
  smallMetric: {
    alignItems: 'center',
    minWidth: 72,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  track: {
    width: '100%',
    height: BAR_HEIGHT,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: BAR_HEIGHT,
    borderRadius: radius.pill,
  },
  gauge: {
    justifyContent: 'center',
    height: MARKER_HEIGHT,
  },
  band: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: colors.success,
    opacity: 0.6,
  },
  marker: {
    position: 'absolute',
    width: MARKER_WIDTH,
    height: MARKER_HEIGHT,
    marginLeft: -MARKER_WIDTH / 2,
    borderRadius: radius.pill,
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
