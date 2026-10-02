import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Plan, Workout } from '../coach/plan';
import {
  editorHardSessionHint,
  editorMessage,
  editorMessages,
} from '../coach/planOnboardingScript';
import type { RunnerProfile } from '../coach/runnerProfile';
import {
  amountFraction,
  availableKinds,
  defaultDraft,
  draftFromWorkout,
  draftStats,
  editedWorkout,
  editorContext,
  nextToHardSession,
  sameDraft,
  workoutType,
  type Draft,
  type EditorKind,
} from '../coach/workoutEditor';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';
import { colors, radius, spacing, typography } from '../theme';
import { formatLongDate } from '../utils/dates';
import { formatPaceSeconds } from '../utils/format';
import { lightImpact, successNotification } from '../utils/haptics';
import BottomSheet from './BottomSheet';
import Button from './Button';
import ChatBubble from './ChatBubble';
import DurationBar from './DurationBar';
import MikeAvatar from './MikeAvatar';
import WorkoutTypeCarousel from './WorkoutTypeCarousel';
import { formatKm, formatMinutes, WORKOUT_TYPE_COLORS } from './WorkoutCard';

// Space the sheet leaves at the top, and what the grabber and bottom
// padding take, so the content height fills the rest of the screen.
const SHEET_TOP_GAP = spacing.sm;
const SHEET_CHROME = 64;
// Below this window height the content would not fit above the summary.
const COMPACT_WINDOW_HEIGHT = 760;

type Props = {
  /** The workout being edited; kept while the sheet animates out. */
  workout: Workout | null;
  visible: boolean;
  /** Change it on every open to start from a fresh draft. */
  contentKey: number;
  plan: Plan;
  profile: RunnerProfile;
  /** Save the edited workout (already marked `edited`). */
  onSave: (workout: Workout) => void;
  /** Restore the generated workout and clear `edited`. */
  onReset: (workout: Workout) => void;
  onDismiss: () => void;
  onClosed: () => void;
  reduceMotion?: boolean;
};

/**
 * Full-height sheet to change a planned workout's type and length:
 * a run type carousel, a draggable duration bar, live totals and a
 * coach line. Save marks the workout as edited so plan updates keep it.
 */
export default function WorkoutEditorSheet({
  workout,
  visible,
  contentKey,
  plan,
  profile,
  onSave,
  onReset,
  onDismiss,
  onClosed,
  reduceMotion = false,
}: Props) {
  return (
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      onClosed={onClosed}
      reduceMotion={reduceMotion}
    >
      {workout && (
        <EditorContent
          key={contentKey}
          workout={workout}
          plan={plan}
          profile={profile}
          onSave={onSave}
          onReset={onReset}
          onCancel={onDismiss}
          reduceMotion={reduceMotion}
        />
      )}
    </BottomSheet>
  );
}

function colorFor(kind: EditorKind) {
  const type = workoutType(kind);
  return WORKOUT_TYPE_COLORS[type === 'rest' ? 'easy' : type];
}

type ContentProps = {
  workout: Workout;
  plan: Plan;
  profile: RunnerProfile;
  onSave: (workout: Workout) => void;
  onReset: (workout: Workout) => void;
  onCancel: () => void;
  reduceMotion: boolean;
};

function EditorContent({
  workout,
  plan,
  profile,
  onSave,
  onReset,
  onCancel,
  reduceMotion,
}: ContentProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const height = windowHeight - insets.top - insets.bottom - SHEET_CHROME - SHEET_TOP_GAP;

  const ctx = useMemo(
    () => editorContext(plan, profile, workout.date),
    [plan, profile, workout.date],
  );
  // What the workout is when the editor opens: the draft starts here.
  const initial = useMemo(() => draftFromWorkout(workout, ctx), [workout, ctx]);
  const kinds = useMemo(
    () => availableKinds(profile, initial.kind),
    [profile, initial.kind],
  );

  const [draft, setDraft] = useState<Draft>(initial);
  // Each type remembers its own length, so flipping between types while
  // exploring never loses what was set.
  const memory = useRef<Partial<Record<EditorKind, number>>>({
    [initial.kind]: initial.amount,
  });
  const [dragging, setDragging] = useState(false);
  const submittedRef = useRef(false);

  // Stable callbacks, so the carousel and the bar skip re-rendering when
  // only the other one changed.
  const selectKind = useCallback(
    (kind: EditorKind) =>
      setDraft((current) =>
        kind === current.kind
          ? current
          : {
              kind,
              amount: memory.current[kind] ?? defaultDraft(kind, ctx).amount,
            },
      ),
    [ctx],
  );

  const setAmount = useCallback((amount: number) => {
    setDraft((current) => {
      memory.current[current.kind] = amount;
      return current.amount === amount ? current : { kind: current.kind, amount };
    });
  }, []);

  // Each draft's numbers are built once: dragging back and forth over the
  // same minutes only reads them.
  const statsCache = useRef(new Map<string, ReturnType<typeof draftStats>>());
  const stats = useMemo(() => {
    const key = `${draft.kind}:${draft.amount}`;
    let cached = statsCache.current.get(key);
    if (!cached) {
      cached = draftStats(workout.id, draft, ctx);
      statsCache.current.set(key, cached);
    }
    return cached;
  }, [workout.id, draft, ctx]);
  const message = editorMessage(
    draft.kind,
    amountFraction(draft.kind, draft.amount, ctx),
  );
  const showHint = nextToHardSession(plan, workout.date, draft.kind);
  const unchanged = sameDraft(draft, initial);
  const color = colorFor(draft.kind);

  // Short screens (iPhone SE, 8): Mike's line goes below the bar, so the
  // bar and its labels fit without scrolling (scroll is locked mid-drag).
  const compact = windowHeight < COMPACT_WINDOW_HEIGHT;
  const mikeLine = (
    <MikeLine
      key={draft.kind}
      message={message}
      alternatives={editorMessages[draft.kind]}
      reduceMotion={reduceMotion}
    />
  );

  const handleSave = () => {
    if (unchanged || submittedRef.current) return;
    submittedRef.current = true;
    successNotification();
    onSave(editedWorkout(workout, draft, ctx));
  };

  const handleReset = () => {
    if (!workout.edited || submittedRef.current) return;
    submittedRef.current = true;
    lightImpact();
    onReset(workout);
  };

  return (
    <View style={{ height }}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[typography.title2, styles.title]}>Edit workout</Text>
          <Text style={[typography.subheadline, styles.subtitle]}>
            {formatLongDate(workout.date)}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !workout.edited }}
          disabled={!workout.edited}
          onPress={handleReset}
          hitSlop={8}
          style={({ pressed }) => [
            styles.reset,
            !workout.edited && styles.resetDisabled,
            pressed && styles.resetPressed,
          ]}
        >
          <Text style={[typography.subheadline, styles.resetText]}>
            Reset to suggested
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={!dragging}
        showsVerticalScrollIndicator={false}
      >
        <WorkoutTypeCarousel
          kinds={kinds}
          selected={draft.kind}
          onSelect={selectKind}
          reduceMotion={reduceMotion}
        />

        {!compact && mikeLine}

        <DurationBar
          kind={draft.kind}
          ctx={ctx}
          amount={draft.amount}
          color={color}
          onAmountChange={setAmount}
          onDraggingChange={setDragging}
          reduceMotion={reduceMotion}
        />

        {compact && mikeLine}

        {showHint && <Hint reduceMotion={reduceMotion} />}
      </ScrollView>

      {/* Pinned above the footer: never pushed out of view by the content. */}
      <View style={styles.summaryBlock}>
        <Summary
          seconds={stats.seconds}
          meters={stats.meters}
          pace={stats.pace}
          fastPace={draft.kind === 'intervals'}
          topZone={stats.topZone}
          // Numbers glide only at rest: mid-drag they follow each step.
          reduceMotion={reduceMotion || dragging}
        />
      </View>

      <View style={styles.footer}>
        <Button
          label="Save"
          variant="accent"
          disabled={unchanged}
          onPress={handleSave}
        />
        <Button label="Cancel" variant="secondary" onPress={onCancel} />
      </View>
    </View>
  );
}

type MikeLineProps = {
  message: string;
  /** Every line Mike can say for this run type. */
  alternatives: readonly string[];
  reduceMotion: boolean;
};

/**
 * Mike's line with the avatar. The bubble area keeps the height of the
 * tallest line it can show, so a longer line never pushes the duration bar
 * down while it is being dragged.
 */
const MikeLine = React.memo(function MikeLine({
  message,
  alternatives,
  reduceMotion,
}: MikeLineProps) {
  const [minHeight, setMinHeight] = useState(0);

  // Only a taller line raises the reserved height: one update per copy at
  // most, when the run type's lines first lay out.
  const handleMeasure = useCallback((height: number) => {
    setMinHeight((current) => (height > current ? height : current));
  }, []);

  return (
    <View style={styles.mikeRow}>
      <MikeAvatar />
      <View style={[styles.mikeBubble, { minHeight }]}>
        {/* Keyed by the line, so a new one pops in like a chat. */}
        <ChatBubble
          key={message}
          text={message}
          sender="mike"
          reduceMotion={reduceMotion}
        />
        <MeasureCopies lines={alternatives} onMeasure={handleMeasure} />
      </View>
    </View>
  );
});

/**
 * Invisible copies of every line, only to measure the tallest. Memoized
 * on the lines, so they render once per run type and never while the
 * current line changes.
 */
const MeasureCopies = React.memo(function MeasureCopies({
  lines,
  onMeasure,
}: {
  lines: readonly string[];
  onMeasure: (height: number) => void;
}) {
  return (
    <>
      {lines.map((text) => (
        <View
          key={text}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.mikeMeasure}
          onLayout={(event) => onMeasure(event.nativeEvent.layout.height)}
        >
          <ChatBubble
            text={text}
            sender="mike"
            animateOnMount={false}
            reduceMotion
          />
        </View>
      ))}
    </>
  );
});

type SummaryProps = {
  seconds: number;
  meters: number;
  pace: ReturnType<typeof draftStats>['pace'];
  fastPace: boolean;
  /** Sessions show their hardest zone instead of a pace. */
  topZone: ReturnType<typeof draftStats>['topZone'];
  reduceMotion: boolean;
};

/**
 * Total time, distance and pace (or top zone) in one compact row, so the
 * pinned block leaves the bar and its labels room. Numbers glide at rest.
 */
const Summary = React.memo(function Summary({
  seconds,
  meters,
  pace,
  fastPace,
  topZone,
  reduceMotion,
}: SummaryProps) {
  const time = useAnimatedNumber(seconds, reduceMotion);
  const km = useAnimatedNumber(meters, reduceMotion);
  const paceMin = useAnimatedNumber(
    pace === null ? 0 : typeof pace === 'number' ? pace : pace.min,
    reduceMotion,
  );
  const paceMax = useAnimatedNumber(
    pace === null ? 0 : typeof pace === 'number' ? pace : pace.max,
    reduceMotion,
  );

  const paceText =
    topZone !== null
      ? `Z${topZone}`
      : pace === null
      ? '–'
      : typeof pace === 'number'
        ? formatPaceSeconds(Math.round(paceMin))
        : `${formatPaceSeconds(Math.round(paceMin))}–${formatPaceSeconds(Math.round(paceMax))}`;
  const timeText = formatMinutes(time);
  const distanceText = formatKm(km);

  return (
    <View
      style={styles.summary}
      accessible
      accessibilityLabel={`Total time ${formatMinutes(seconds)}, distance ${formatKm(meters)}, ${
        topZone !== null ? `top zone ${topZone}` : `pace ${paceText} per kilometer`
      }`}
    >
      <View style={styles.summaryItem}>
        <Text style={[typography.largeTitle, styles.summaryValue]}>
          {timeText}
        </Text>
        <Text style={[typography.caption, styles.summaryLabel]}>
          total time
        </Text>
      </View>
      <View style={styles.summaryItem}>
        <Text style={[typography.title2, styles.summaryValue]}>
          {distanceText}
        </Text>
        <Text style={[typography.caption, styles.summaryLabel]}>
          est. distance
        </Text>
      </View>
      <View style={styles.summaryItem}>
        <Text style={[typography.title2, styles.summaryValue]}>
          {paceText}
        </Text>
        <Text style={[typography.caption, styles.summaryLabel]}>
          {topZone !== null ? 'top zone' : fastPace ? 'fast pace /km' : 'pace /km'}
        </Text>
      </View>
    </View>
  );
});

/** The soft warning about two hard sessions in a row. */
function Hint({ reduceMotion }: { reduceMotion: boolean }) {
  const entrance = useEntranceAnimation({
    animate: true,
    reduceMotion,
    offsetY: 8,
  });
  return (
    <Animated.View
      accessibilityRole="alert"
      style={[styles.hint, entrance]}
    >
      <Text style={[typography.subheadline, styles.hintText]}>
        {editorHardSessionHint}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerText: {
    flexShrink: 1,
    gap: spacing.xxs,
  },
  title: {
    color: colors.textPrimary,
  },
  subtitle: {
    color: colors.textSecondary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing.md,
    // The bar's labels sit last: room so they never touch the edge.
    paddingBottom: spacing.xl,
  },
  mikeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  mikeBubble: {
    flex: 1,
  },
  mikeMeasure: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    opacity: 0,
  },
  summaryBlock: {
    paddingVertical: spacing.sm,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.lg,
  },
  summaryItem: {
    gap: 0,
  },
  summaryLabel: {
    color: colors.textSecondary,
  },
  summaryValue: {
    color: colors.textPrimary,
  },
  hint: {
    borderRadius: radius.md,
    backgroundColor: colors.statOrangeBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  hintText: {
    color: colors.planCardAccent,
    fontWeight: '600',
  },
  footer: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  reset: {
    paddingVertical: spacing.xxs,
    paddingLeft: spacing.xs,
  },
  resetText: {
    color: colors.iosBlue,
  },
  resetDisabled: {
    opacity: 0.35,
  },
  resetPressed: {
    opacity: 0.5,
  },
});
