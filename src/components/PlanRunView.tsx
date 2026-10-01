import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import type { RunViewProps } from '../run/types';
import { displayName, type Workout } from '../coach/plan';
import {
  buildRunSegments,
  formatSegmentTarget,
  type RunSegment,
} from '../run/workoutSegments';
import { useWorkoutRun } from '../hooks/useWorkoutRun';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors, motion, radius, spacing, typography } from '../theme';
import { formatClock } from '../utils/format';
import { mediumImpact, successNotification } from '../utils/haptics';
import AlertBlock from './AlertBlock';
import BasicRunView from './BasicRunView';
import Button from './Button';
import WorkoutProgressBar, { SEGMENT_TONE_COLORS } from './WorkoutProgressBar';
import { formatPace } from './WorkoutCard';

const BAR_HEIGHT = 8;
/** The countdown bar glides between tracking ticks (about one a second). */
const DRAIN_MS = 1000;
const SEGMENT_ENTER_MS = 320;
const SEGMENT_ENTER_PX = 10;
const TONE_DOT = 10;

/**
 * Run screen for "Today's workout": runs the workout segment by segment
 * with a countdown, the rep counter, the next segment, a bar for the whole
 * workout and the target pace with the goal runs' silent red alert.
 */
export default function PlanRunView(props: RunViewProps) {
  const { workout } = props;
  const segments = useMemo(() => (workout ? buildRunSegments(workout) : []), [workout]);
  // No workout (or a rest day) has nothing to execute: show the basic run.
  if (!workout || segments.length === 0) return <BasicRunView {...props} />;
  return <PlanRun {...props} workout={workout} segments={segments} />;
}

/** "1:30" / "12:05" left, or "320 m" / "1.25 km" left. */
function countdown(segment: RunSegment, remaining: number) {
  if (segment.target.type === 'duration') {
    const total = Math.ceil(remaining);
    const clock = formatClock(total);
    // Drop the leading zero of the minutes: "1:30", not "01:30".
    return { value: total < 600 ? clock.replace(/^0/, '') : clock, unit: '' };
  }
  return remaining < 1000
    ? { value: String(Math.ceil(remaining / 10) * 10), unit: 'm' }
    : { value: (remaining / 1000).toFixed(2), unit: 'km' };
}

function PlanRun({
  runState,
  distanceKm,
  durationSeconds,
  paceLabel,
  themeAnim,
  workout,
  segments,
  onPause,
  onResume,
  onFinish,
}: RunViewProps & { workout: Workout; segments: RunSegment[] }) {
  const reduceMotion = useReduceMotion();
  const run = useWorkoutRun(segments, runState, distanceKm, durationSeconds);
  const [keepGoing, setKeepGoing] = useState(false);
  const { segment, next, progress, complete } = run;

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

  // Haptics on segment changes and at the end of the workout.
  useEffect(
    () =>
      run.events.subscribe((event) => {
        if (event.type === 'segmentStart' && event.segment.index > 0) mediumImpact();
        if (event.type === 'workoutComplete') successNotification();
      }),
    [run.events],
  );

  // The countdown bar drains smoothly, and refills at a new segment.
  const index = segment?.index ?? segments.length;
  const drain = useRef(new Animated.Value(1)).current;
  const lastIndex = useRef(index);
  useEffect(() => {
    if (lastIndex.current !== index || reduceMotion) {
      drain.setValue(progress.fractionLeft);
      return;
    }
    const animation = Animated.timing(drain, {
      toValue: progress.fractionLeft,
      duration: DRAIN_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress.fractionLeft, index, reduceMotion, drain]);

  // A new segment fades (and, without Reduce Motion, slides) in.
  const enter = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (lastIndex.current === index) return;
    lastIndex.current = index;
    enter.setValue(0);
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: SEGMENT_ENTER_MS,
      easing: motion.easeStandard,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [index, enter]);
  const enterStyle = {
    opacity: enter,
    transform: [
      {
        translateY: reduceMotion
          ? 0
          : enter.interpolate({ inputRange: [0, 1], outputRange: [SEGMENT_ENTER_PX, 0] }),
      },
    ],
  };

  const handleFinish = () => {
    run.finishEarly();
    onFinish();
  };

  const paused = runState === 'paused';
  const showWorkoutChoice = complete && !keepGoing && runState === 'running';
  const waitingForGps =
    segment?.target.type === 'distance' && distanceKm === 0 && runState === 'running';

  return (
    <View style={styles.content}>
      <Animated.Text
        numberOfLines={1}
        style={[typography.headline, { color: theme.text }]}
      >
        {paused ? 'Paused' : displayName(workout)}
      </Animated.Text>

      <View style={styles.main}>
        <Animated.View style={[styles.segment, enterStyle]}>
          {segment ? (
            <SegmentBlock
              segment={segment}
              remaining={progress.remaining}
              drain={drain}
              theme={theme}
              waitingForGps={waitingForGps}
            />
          ) : (
            <View style={styles.doneBlock}>
              <Animated.Text style={[styles.doneTitle, { color: theme.text }]}>
                Workout complete ✓
              </Animated.Text>
              <Animated.Text style={[typography.subheadline, { color: theme.secondary }]}>
                {keepGoing ? 'Running freely' : 'Keep going or finish when you are ready.'}
              </Animated.Text>
            </View>
          )}
        </Animated.View>

        {segment?.paceRange && (
          <AlertBlock alert={run.paceAlert} reduceMotion={reduceMotion} red={theme.red}>
            <View style={styles.paceRow}>
              <Animated.Text style={[typography.subheadline, { color: theme.secondary }]}>
                {`Target ${formatPace(segment.paceRange)} /km`}
              </Animated.Text>
              <View style={styles.paceValue}>
                <Animated.Text
                  style={[
                    styles.paceNumber,
                    { color: run.paceAlert ? theme.red : theme.text },
                  ]}
                >
                  {paceLabel}
                </Animated.Text>
                <Animated.Text style={[typography.subheadline, { color: theme.secondary }]}>
                  /km
                </Animated.Text>
              </View>
            </View>
          </AlertBlock>
        )}

        <View style={styles.workoutBar}>
          <Animated.Text
            numberOfLines={1}
            style={[typography.subheadline, { color: theme.secondary }]}
          >
            {segment
              ? next
                ? `Next: ${next.label} · ${formatSegmentTarget(next)}`
                : 'Last segment'
              : ' '}
          </Animated.Text>
          <WorkoutProgressBar
            segments={segments}
            currentIndex={index}
            overall={progress.overall}
            markerColor={theme.text}
          />
        </View>

        <View style={styles.totals}>
          <SmallMetric value={formatClock(durationSeconds)} label="Time" theme={theme} />
          <SmallMetric value={`${distanceKm.toFixed(2)} km`} label="Distance" theme={theme} />
          {!segment?.paceRange && (
            <SmallMetric value={`${paceLabel} /km`} label="Pace" theme={theme} />
          )}
        </View>
      </View>

      <View style={styles.controls}>
        {!complete && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip segment"
            hitSlop={12}
            onPress={run.skip}
            style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
          >
            <Animated.Text style={[typography.headline, { color: theme.secondary }]}>
              Skip segment ›
            </Animated.Text>
          </Pressable>
        )}
        <View style={styles.controlsRow}>
          {showWorkoutChoice ? (
            <Button
              label="Keep going"
              variant="runPause"
              appearanceAnim={themeAnim}
              onPress={() => setKeepGoing(true)}
              style={styles.controlButton}
            />
          ) : paused ? (
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
            onPress={handleFinish}
            style={styles.controlButton}
          />
        </View>
      </View>
    </View>
  );
}

type Themed = Animated.AnimatedInterpolation<string | number>;
type Theme = { text: Themed; secondary: Themed; red: Themed; track: Themed };

/** Segment name, rep counter, the countdown and its draining bar. */
function SegmentBlock({
  segment,
  remaining,
  drain,
  theme,
  waitingForGps,
}: {
  segment: RunSegment;
  remaining: number;
  drain: Animated.Value;
  theme: Theme;
  waitingForGps: boolean;
}) {
  const tone = SEGMENT_TONE_COLORS[segment.tone];
  const { value, unit } = countdown(segment, remaining);
  return (
    <>
      <View style={styles.segmentHeader}>
        <View style={styles.labelRow}>
          <View style={[styles.toneDot, { backgroundColor: tone }]} />
          <Animated.Text style={[typography.title2, { color: theme.text }]}>
            {segment.label}
          </Animated.Text>
        </View>
        {segment.rep && (
          <Animated.Text style={[typography.headline, styles.tabular, { color: theme.secondary }]}>
            {`Rep ${segment.rep.number} of ${segment.rep.of}`}
          </Animated.Text>
        )}
      </View>

      <View
        style={styles.countdownRow}
        accessible
        accessibilityLabel={`${value} ${unit === 'm' ? 'meters' : unit === 'km' ? 'kilometers' : ''} left`}
      >
        <Animated.Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[styles.countdown, { color: theme.text }]}
        >
          {value}
        </Animated.Text>
        {unit !== '' && (
          <Animated.Text style={[typography.title2, { color: theme.secondary }]}>
            {unit}
          </Animated.Text>
        )}
      </View>

      <Animated.View style={[styles.drainTrack, { backgroundColor: theme.track }]}>
        <Animated.View
          style={[
            styles.drainFill,
            { backgroundColor: tone, transform: [{ scaleX: drain }] },
          ]}
        />
      </Animated.View>

      <Animated.Text style={[typography.caption, { color: theme.secondary }]}>
        {waitingForGps ? 'Waiting for GPS…' : `${formatSegmentTarget(segment)} total`}
      </Animated.Text>
    </>
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

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  main: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  segment: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  segmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  toneDot: {
    width: TONE_DOT,
    height: TONE_DOT,
    borderRadius: TONE_DOT / 2,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  countdown: {
    flexShrink: 1,
    fontSize: 84,
    fontWeight: '800',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  drainTrack: {
    width: '100%',
    height: BAR_HEIGHT,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  drainFill: {
    height: BAR_HEIGHT,
    width: '100%',
    borderRadius: radius.pill,
    transformOrigin: 'left',
  },
  doneBlock: {
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  doneTitle: {
    fontSize: 34,
    fontWeight: '800',
  },
  paceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paceValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xxs,
  },
  paceNumber: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  workoutBar: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  totals: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  smallMetric: {
    alignItems: 'center',
    minWidth: 72,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  controls: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.md,
  },
  skip: {
    paddingVertical: spacing.xxs,
  },
  pressed: {
    opacity: 0.6,
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
