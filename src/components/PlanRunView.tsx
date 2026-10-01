import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import type { RunViewProps } from '../run/types';
import { displayName, type Workout } from '../coach/plan';
import { ZONE_INFO } from '../coach/zones';
import {
  buildRunSegments,
  formatSegmentTarget,
  type RunSegment,
} from '../run/workoutSegments';
import {
  nextWork,
  sessionStyle,
  stepLayout,
  zoneTimeline,
  type StepLayout,
} from '../run/stepBehavior';
import { formatEffortTime, setSummary, type SetSummary } from '../run/repResults';
import { useWorkoutRun } from '../hooks/useWorkoutRun';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors, motion, radius, spacing, typography } from '../theme';
import { formatClock, formatPaceSeconds } from '../utils/format';
import AlertBlock from './AlertBlock';
import BasicRunView from './BasicRunView';
import Button from './Button';
import WorkoutProgressBar, { SEGMENT_TONE_COLORS } from './WorkoutProgressBar';
import { formatPace } from './WorkoutCard';
import ZoneTimeline, { ZONE_COLORS } from './ZoneTimeline';

const BAR_HEIGHT = 8;
/** The countdown bar glides between tracking ticks (about one a second). */
const DRAIN_MS = 1000;
const SEGMENT_ENTER_MS = 320;
const SEGMENT_ENTER_PX = 10;
const TONE_DOT = 10;
/** Done and Ready: large and easy to hit while running. */
const MANUAL_BUTTON_HEIGHT = 76;

/**
 * Run screen for "Today's workout": runs the workout step by step, and
 * each step shows what matters for it (see stepBehavior.ts):
 * - intervals: a countdown by time or distance, "Rep i of n", "Set j of m";
 * - rests: a calm countdown to the next rep with a preview of it, and the
 *   set summary in a macro rest;
 * - manual steps: an elapsed timer and one large Done or Ready button;
 * - Z2 sessions: the distance run as the hero;
 * - consecutive-zone sessions: the zone, its time left and a timeline.
 * Every step shows its zone and target pace (zones are pace ranges, no
 * heart rate yet), with the goal runs' silent red alert where it applies.
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
  if (segment.target.type === 'distance') {
    return remaining < 1000
      ? { value: String(Math.ceil(remaining / 10) * 10), unit: 'm' }
      : { value: (remaining / 1000).toFixed(2), unit: 'km' };
  }
  return { value: shortClock(Math.ceil(remaining)), unit: '' };
}

/** Drop the leading zero of the minutes: "1:30", not "01:30". */
function shortClock(seconds: number) {
  const clock = formatClock(Math.max(0, seconds));
  return seconds < 600 ? clock.replace(/^0/, '') : clock;
}

function counterText(segment: RunSegment) {
  if (!segment.rep) return null;
  // A block of one rep has nothing to count.
  if (segment.rep.of === 1 && !segment.set) return null;
  const rep = `Rep ${segment.rep.number} of ${segment.rep.of}`;
  return segment.set ? `Set ${segment.set.number} of ${segment.set.of} · ${rep}` : rep;
}

function PlanRun({
  runState,
  distanceKm,
  durationSeconds,
  paceLabel,
  themeAnim,
  workout,
  title,
  segments,
  onPause,
  onResume,
  onFinish,
}: RunViewProps & { workout: Workout; segments: RunSegment[] }) {
  const reduceMotion = useReduceMotion();
  const run = useWorkoutRun(segments, runState, distanceKm, durationSeconds);
  const [keepGoing, setKeepGoing] = useState(false);
  const { segment, next, progress, complete } = run;
  const style = useMemo(() => sessionStyle(segments), [segments]);
  const layout: StepLayout | null = segment ? stepLayout(segment, style) : null;

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
    // Read before finishing: Finish itself cuts the current step short.
    const { completedAll } = run.outcome();
    run.finishEarly();
    onFinish({ completedAll, reps: run.recordedReps() });
  };

  const paused = runState === 'paused';
  const showWorkoutChoice = complete && !keepGoing && runState === 'running';
  const manualEnd = layout === 'manual' && segment ? segment.end : null;
  const waitingForGps =
    segment?.target.type === 'distance' && distanceKm === 0 && runState === 'running';
  // The rep after a rest, and in a macro rest how the last set went.
  const upcoming = segment?.rest !== null && segment ? nextWork(segments, index) : null;
  const summary =
    segment?.rest === 'macro' && segment.set ? setSummary(run.reps, segment.set) : null;
  // Rests and manual steps never alert; their zone (if any) is only a hint.
  const showPaceBlock = segment?.paceRange && segment.rest === null && layout !== 'manual';

  return (
    <View style={styles.content}>
      <Animated.Text
        numberOfLines={1}
        style={[typography.headline, { color: theme.text }]}
      >
        {paused ? 'Paused' : (title ?? displayName(workout))}
      </Animated.Text>

      <View style={styles.main}>
        <Animated.View style={[styles.segment, enterStyle]}>
          {segment && layout ? (
            <>
              <StepHeader segment={segment} layout={layout} theme={theme} />
              <StepHero
                segment={segment}
                layout={layout}
                remaining={progress.remaining}
                elapsed={progress.elapsedSeconds}
                distanceKm={distanceKm}
                drain={drain}
                theme={theme}
              />
              {layout === 'zoneBlock' && (
                <ZoneTimeline blocks={zoneTimeline(segments, index)} labelColor={theme.secondary} />
              )}
              <StepFooter
                segment={segment}
                layout={layout}
                upcoming={upcoming}
                summary={summary}
                waitingForGps={waitingForGps}
                theme={theme}
              />
            </>
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

        {showPaceBlock && segment?.paceRange && (
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
              ? upcoming
                ? ' ' // the rest already previews the next rep
                : next
                ? `Next: ${next.label}${
                    next.zone && !next.label.startsWith('Zone') ? ` · Z${next.zone}` : ''
                  } · ${formatSegmentTarget(next)}`
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

        {/* Whole-run totals: rests count toward time and distance. */}
        <View style={styles.totals}>
          <SmallMetric value={formatClock(durationSeconds)} label="Time" theme={theme} />
          {layout !== 'distance' && (
            <SmallMetric value={`${distanceKm.toFixed(2)} km`} label="Distance" theme={theme} />
          )}
          {!showPaceBlock && (
            <SmallMetric value={`${paceLabel} /km`} label="Pace" theme={theme} />
          )}
        </View>
      </View>

      <View style={styles.controls}>
        {manualEnd && !paused ? (
          <Button
            label={manualEnd === 'done' ? 'Done' : 'Ready'}
            variant="accent"
            onPress={run.confirm}
            style={styles.manualButton}
          />
        ) : (
          !complete &&
          !manualEnd && (
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
          )
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

/** Rests stay calm; a zoned effort takes its zone's color; else its tone. */
function stepColor(segment: RunSegment) {
  if (segment.rest !== null) return colors.segmentRecovery;
  if (segment.zone !== null) return ZONE_COLORS[segment.zone];
  return SEGMENT_TONE_COLORS[segment.tone];
}

type Themed = Animated.AnimatedInterpolation<string | number>;
type Theme = { text: Themed; secondary: Themed; red: Themed; track: Themed };

/** The step's name, its zone chip, and the rep / set counter. */
function StepHeader({
  segment,
  layout,
  theme,
}: {
  segment: RunSegment;
  layout: StepLayout;
  theme: Theme;
}) {
  const counter = counterText(segment);
  const title =
    layout === 'zoneBlock' && segment.zone !== null && segment.kind === 'steady'
      ? ZONE_INFO[segment.zone].name
      : segment.label;
  return (
    <View style={styles.segmentHeader}>
      <View style={styles.labelRow}>
        <View style={[styles.toneDot, { backgroundColor: stepColor(segment) }]} />
        <Animated.Text
          numberOfLines={1}
          style={[typography.title2, styles.flexShrink, { color: theme.text }]}
        >
          {title}
        </Animated.Text>
        {segment.zone !== null && (
          <View
            style={[styles.zoneChip, { backgroundColor: ZONE_COLORS[segment.zone] }]}
            accessible
            accessibilityLabel={`Zone ${segment.zone}`}
          >
            <Animated.Text style={[typography.caption, styles.zoneChipText]}>
              {`Z${segment.zone}`}
            </Animated.Text>
          </View>
        )}
      </View>
      {counter && (
        <Animated.Text style={[typography.headline, styles.tabular, { color: theme.secondary }]}>
          {counter}
        </Animated.Text>
      )}
    </View>
  );
}

/** The big number of the step: countdown, elapsed timer or distance. */
function StepHero({
  segment,
  layout,
  remaining,
  elapsed,
  distanceKm,
  drain,
  theme,
}: {
  segment: RunSegment;
  layout: StepLayout;
  remaining: number;
  elapsed: number;
  distanceKm: number;
  drain: Animated.Value;
  theme: Theme;
}) {
  const calm = segment.rest !== null;
  const barColor = stepColor(segment);

  if (layout === 'manual') {
    // No end to count down to: how long it has been, until the tap.
    return (
      <View
        style={styles.countdownRow}
        accessible
        accessibilityLabel={`${formatClock(elapsed)} elapsed. Tap ${
          segment.end === 'done' ? 'Done' : 'Ready'
        } when finished`}
      >
        <Animated.Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[styles.countdown, calm && styles.calmNumber, { color: theme.text }]}
        >
          {shortClock(elapsed)}
        </Animated.Text>
        <Animated.Text style={[typography.title2, { color: theme.secondary }]}>
          {segment.end === 'ready' ? 'resting' : 'elapsed'}
        </Animated.Text>
      </View>
    );
  }

  const left = countdown(segment, remaining);
  const hero =
    layout === 'distance'
      ? { value: distanceKm.toFixed(2), unit: 'km', label: `${distanceKm.toFixed(2)} kilometers run` }
      : {
          ...left,
          label: `${left.value} ${left.unit === 'm' ? 'meters' : left.unit === 'km' ? 'kilometers' : ''} left`,
        };

  return (
    <>
      <View style={styles.countdownRow} accessible accessibilityLabel={hero.label}>
        <Animated.Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[styles.countdown, calm && styles.calmNumber, { color: theme.text }]}
        >
          {hero.value}
        </Animated.Text>
        {hero.unit !== '' && (
          <Animated.Text style={[typography.title2, { color: theme.secondary }]}>
            {hero.unit}
          </Animated.Text>
        )}
      </View>
      <Animated.View style={[styles.drainTrack, { backgroundColor: theme.track }]}>
        <Animated.View
          style={[styles.drainFill, { backgroundColor: barColor, transform: [{ scaleX: drain }] }]}
        />
      </Animated.View>
      {layout === 'distance' && (
        <Animated.Text style={[typography.subheadline, { color: theme.secondary }]}>
          {`${left.value}${left.unit ? ` ${left.unit}` : ''} left in this block`}
        </Animated.Text>
      )}
    </>
  );
}

/**
 * Under the hero: the zone hint, why there is no pace target, the next
 * rep during a rest, the set summary in a macro rest, or the step total.
 */
function StepFooter({
  segment,
  layout,
  upcoming,
  summary,
  waitingForGps,
  theme,
}: {
  segment: RunSegment;
  layout: StepLayout;
  upcoming: RunSegment | null;
  summary: SetSummary | null;
  waitingForGps: boolean;
  theme: Theme;
}) {
  const lines: string[] = [];
  if (segment.rest !== null) {
    // Active rests show their zone as a hint; nothing alerts.
    if (segment.zone !== null) {
      lines.push(
        segment.paceRange
          ? `Easy in Z${segment.zone} · ${formatPace(segment.paceRange)} /km`
          : `Easy in Z${segment.zone}`,
      );
    } else if (layout === 'manual') {
      lines.push('Full recovery: take all the time you need, then tap Ready.');
    }
    if (summary) {
      const set = segment.set ? `Set ${segment.set.number} done · ` : '';
      lines.push(
        summary.avgPaceSecPerKm !== null
          ? `${set}${summary.reps} reps · avg ${formatPaceSeconds(summary.avgPaceSecPerKm)} /km`
          : `${set}${summary.reps} reps · avg ${formatEffortTime(summary.avgSeconds)}`,
      );
    }
    if (upcoming) {
      const zone = upcoming.zone ? ` · Z${upcoming.zone}` : '';
      const pace = upcoming.paceRange ? ` · ${formatPace(upcoming.paceRange)}` : '';
      lines.push(`Up next: ${upcoming.label} · ${formatSegmentTarget(upcoming)}${zone}${pace}`);
    }
  } else if (layout === 'manual') {
    lines.push(
      segment.target.type === 'manual' && segment.target.meters !== undefined
        ? `Sprint ${segment.target.meters} m, then tap Done.`
        : 'Tap Done when you finish.',
    );
  } else {
    if (segment.zone !== null && !segment.paceRange) {
      lines.push(`Z${segment.zone} · No pace target: too short for GPS`);
    }
    if (layout !== 'distance') {
      lines.push(waitingForGps ? 'Waiting for GPS…' : `${formatSegmentTarget(segment)} total`);
    }
  }
  if (lines.length === 0) return null;
  return (
    <View style={styles.footerLines}>
      {lines.map((line) => (
        <Animated.Text key={line} style={[typography.subheadline, { color: theme.secondary }]}>
          {line}
        </Animated.Text>
      ))}
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
  // Name and zone on one line, the rep / set counter under it, so a long
  // name and "Set 1 of 2 · Rep 3 of 8" never squeeze each other.
  segmentHeader: {
    gap: spacing.xxs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  flexShrink: {
    flexShrink: 1,
  },
  toneDot: {
    width: TONE_DOT,
    height: TONE_DOT,
    borderRadius: TONE_DOT / 2,
  },
  zoneChip: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  zoneChipText: {
    color: colors.white,
    fontWeight: '700',
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
  // Rests: the same number, lighter, so the screen feels calmer.
  calmNumber: {
    fontWeight: '300',
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
  footerLines: {
    gap: spacing.xxs,
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
  manualButton: {
    width: '100%',
    height: MANUAL_BUTTON_HEIGHT,
    borderRadius: radius.button,
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
