import React, { useMemo, useRef, useState } from 'react';
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

  const selectKind = (kind: EditorKind) => {
    if (kind === draft.kind) return;
    setDraft({
      kind,
      amount: memory.current[kind] ?? defaultDraft(kind, ctx).amount,
    });
  };

  const setAmount = (amount: number) => {
    memory.current[draft.kind] = amount;
    setDraft({ kind: draft.kind, amount });
  };

  const stats = useMemo(
    () => draftStats(workout.id, draft, ctx),
    [workout.id, draft, ctx],
  );
  const message = editorMessage(
    draft.kind,
    amountFraction(draft.kind, draft.amount, ctx),
  );
  const showHint = nextToHardSession(plan, workout.date, draft.kind);
  const unchanged = sameDraft(draft, initial);
  const color = colorFor(draft.kind);

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

        <View style={styles.mikeRow}>
          <MikeAvatar />
          <View style={styles.mikeBubble}>
            {/* Keyed by the line, so a new one pops in like a chat. */}
            <ChatBubble
              key={message}
              text={message}
              sender="mike"
              reduceMotion={reduceMotion}
            />
          </View>
        </View>

        <DurationBar
          kind={draft.kind}
          ctx={ctx}
          amount={draft.amount}
          color={color}
          onAmountChange={setAmount}
          onDraggingChange={setDragging}
          reduceMotion={reduceMotion}
        />

        <Summary
          seconds={stats.seconds}
          meters={stats.meters}
          pace={stats.pace}
          fastPace={draft.kind === 'intervals'}
          reduceMotion={reduceMotion}
        />

        {showHint && <Hint reduceMotion={reduceMotion} />}
      </ScrollView>

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

type SummaryProps = {
  seconds: number;
  meters: number;
  pace: ReturnType<typeof draftStats>['pace'];
  fastPace: boolean;
  reduceMotion: boolean;
};

/** Total time, distance and pace: big numbers that glide as you drag. */
function Summary({ seconds, meters, pace, fastPace, reduceMotion }: SummaryProps) {
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
    pace === null
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
      accessibilityLabel={`Total time ${formatMinutes(seconds)}, distance ${formatKm(meters)}, pace ${paceText} per kilometer`}
    >
      <View>
        <Text style={[typography.subheadline, styles.summaryLabel]}>
          Total time
        </Text>
        <Text style={[typography.metricBig, styles.summaryTime]}>
          {timeText}
        </Text>
      </View>
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={[typography.title2, styles.summaryValue]}>
            {distanceText}
          </Text>
          <Text style={[typography.subheadline, styles.summaryLabel]}>
            est. distance
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[typography.title2, styles.summaryValue]}>
            {paceText}
          </Text>
          <Text style={[typography.subheadline, styles.summaryLabel]}>
            {fastPace ? 'fast pace /km' : 'pace /km'}
          </Text>
        </View>
      </View>
    </View>
  );
}

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
    paddingBottom: spacing.md,
  },
  mikeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  mikeBubble: {
    flex: 1,
  },
  summary: {
    gap: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  summaryItem: {
    gap: 0,
  },
  summaryLabel: {
    color: colors.textSecondary,
  },
  summaryTime: {
    color: colors.textPrimary,
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
