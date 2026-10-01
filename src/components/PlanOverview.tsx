import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  displayName,
  isRunWalk,
  totalDistance,
  totalDuration,
  upcomingWorkouts,
  type Plan,
  type Workout,
} from '../coach/plan';
import {
  planDayMessage,
  type PlanDayMessageKey,
} from '../coach/planOnboardingScript';
import { rulesFor } from '../coach/generatePlan';
import type { RunnerProfile } from '../coach/runnerProfile';
import { suggestedWorkout } from '../coach/workoutEditor';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';
import {
  addMonths,
  formatDayLabel,
  isSameMonth,
  startOfMonth,
  type ISODate,
} from '../utils/dates';
import { colors, motion, spacing, typography } from '../theme';
import ChatBubble from './ChatBubble';
import MikeAvatar from './MikeAvatar';
import { PlanMonthCalendar, PlanWeekStrip } from './PlanCalendar';
import SegmentedControl from './SegmentedControl';
import WorkoutEditorSheet from './WorkoutEditorSheet';
import ZoneGuideSheet from './ZoneGuideSheet';
import WorkoutCard, {
  formatKm,
  formatMinutes,
  WorkoutSummaryCard,
} from './WorkoutCard';

const COMING_UP_COUNT = 3;

type PlanView = 'week' | 'month';

const VIEW_OPTIONS: { value: PlanView; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

function mikeMessageKey(
  workout: Workout | undefined,
  gentle: boolean,
): PlanDayMessageKey {
  if (!workout) return 'noWorkout';
  if (workout.status === 'completed') return 'completed';
  if (workout.status === 'partial') return 'partial';
  if (workout.status === 'skipped') return 'skipped';
  if (workout.type === 'rest') return 'rest';
  if (gentle) return 'gentle';
  if (isRunWalk(workout)) return 'runWalk';
  return workout.type;
}

type Props = {
  plan: Plan;
  /** Their answers decide which run types the editor offers. */
  profile: RunnerProfile;
  today: ISODate;
  /** An injury hurts now: Mike reminds the user to take it easy. */
  gentle: boolean;
  reduceMotion: boolean;
  /** Replaces Mike's day line until the user picks another day or view. */
  mikeNotice?: string | null;
  onNoticeDismiss?: () => void;
  onStartWorkout: (workout: Workout) => void;
  /** A free run, from a finished workout's "Run again freely". */
  onRunAgain: () => void;
  /** An edited (or reset) workout, to replace the one with the same id. */
  onSaveWorkout: (workout: Workout) => void;
};

/** The training plan: Week and Month views of the user's workouts. */
export default function PlanOverview({
  plan,
  profile,
  today,
  gentle,
  reduceMotion,
  mikeNotice,
  onNoticeDismiss,
  onStartWorkout,
  onRunAgain,
  onSaveWorkout,
}: Props) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<PlanView>('week');
  const [selectedDate, setSelectedDate] = useState(today);
  // Moving on (another day or view) ends Mike's notice.
  const selectDay = useCallback(
    (date: ISODate) => {
      if (date !== selectedDate) onNoticeDismiss?.();
      setSelectedDate(date);
    },
    [selectedDate, onNoticeDismiss],
  );
  const changeView = (next: PlanView) => {
    onNoticeDismiss?.();
    setView(next);
  };
  // The month view always shows the selected day's month, so the card
  // under the grid always matches what the grid shows.
  const visibleMonth = startOfMonth(selectedDate);

  const workoutsByDate = useMemo(
    () => new Map(plan.workouts.map((workout) => [workout.date, workout])),
    [plan],
  );
  const workoutFor = useCallback(
    (date: ISODate) => workoutsByDate.get(date),
    [workoutsByDate],
  );
  const selectedWorkout = workoutFor(selectedDate);
  const messageText =
    mikeNotice ??
    planDayMessage(mikeMessageKey(selectedWorkout, gentle), selectedDate);

  // Only planned training days can be edited, not rest, finished or
  // skipped ones.
  const canEdit =
    selectedWorkout !== undefined &&
    selectedWorkout.type !== 'rest' &&
    selectedWorkout.status === 'planned';

  const [zoneGuideVisible, setZoneGuideVisible] = useState(false);
  const easyPace = useMemo(() => rulesFor(profile).easyPace, [profile]);

  // The editor keeps its workout while the sheet animates out.
  const [editor, setEditor] = useState<{
    workout: Workout | null;
    visible: boolean;
    openCount: number;
  }>({ workout: null, visible: false, openCount: 0 });

  const openEditor = () => {
    if (!selectedWorkout || !canEdit) return;
    setEditor((current) =>
      current.visible
        ? current
        : {
            workout: selectedWorkout,
            visible: true,
            openCount: current.openCount + 1,
          },
    );
  };
  const closeEditor = () =>
    setEditor((current) => ({ ...current, visible: false }));
  const handleEditorClosed = () =>
    setEditor((current) =>
      current.visible ? current : { ...current, workout: null },
    );
  const handleSaveEdit = (workout: Workout) => {
    onSaveWorkout(workout);
    closeEditor();
  };
  const handleResetEdit = async (workout: Workout) => {
    closeEditor();
    const suggested = await suggestedWorkout(plan, profile, workout.date);
    if (!suggested) return;
    // Same day, same id and status; only what the generator decides returns.
    onSaveWorkout({
      ...suggested,
      id: workout.id,
      status: workout.status,
      edited: false,
    });
  };

  // Another month never contains the selection, so moving to it selects
  // its first workout (or its first day when nothing is planned there).
  const changeMonth = useCallback(
    (delta: -1 | 1) => {
      const month = addMonths(visibleMonth, delta);
      const firstWorkout = plan.workouts.find(
        (workout) =>
          isSameMonth(workout.date, month) && workout.type !== 'rest',
      );
      selectDay(firstWorkout?.date ?? month);
    },
    [plan, visibleMonth, selectDay],
  );

  const comingUp = upcomingWorkouts(
    plan,
    selectedDate > today ? selectedDate : today,
    COMING_UP_COUNT,
  );

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SegmentedControl
          options={VIEW_OPTIONS}
          value={view}
          onChange={changeView}
          reduceMotion={reduceMotion}
        />

        <FadeIn key={view} reduceMotion={reduceMotion}>
          {view === 'week' ? (
            <View style={styles.section}>
              <PlanWeekStrip
                selectedDate={selectedDate}
                today={today}
                workoutFor={workoutFor}
                onSelect={selectDay}
              />

              <View style={styles.mikeRow}>
                <MikeAvatar />
                <View style={styles.mikeBubble}>
                  {/* Keyed by message, so a new line pops in like a chat. */}
                  <ChatBubble
                    key={messageText}
                    text={messageText}
                    sender="mike"
                    reduceMotion={reduceMotion}
                  />
                </View>
              </View>

              <Pulse
                id={selectedWorkout?.id}
                content={workoutContent(selectedWorkout)}
                reduceMotion={reduceMotion}
              >
                <WorkoutCard
                  date={selectedDate}
                  today={today}
                  workout={selectedWorkout}
                  onStart={
                    selectedWorkout
                      ? () => onStartWorkout(selectedWorkout)
                      : undefined
                  }
                  onEdit={canEdit ? openEditor : undefined}
                  onRunAgain={onRunAgain}
                  onZoneGuide={() => setZoneGuideVisible(true)}
                />
              </Pulse>

              {comingUp.length > 0 && (
                <View>
                  <Text
                    accessibilityRole="header"
                    style={[typography.subheadline, styles.sectionTitle]}
                  >
                    Coming up
                  </Text>
                  {comingUp.map((workout, index) => (
                    <ComingUpRow
                      key={workout.id}
                      workout={workout}
                      showDivider={index > 0}
                      onPress={() => selectDay(workout.date)}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.section}>
              <PlanMonthCalendar
                month={visibleMonth}
                selectedDate={selectedDate}
                today={today}
                workoutFor={workoutFor}
                onSelect={selectDay}
                onChangeMonth={changeMonth}
              />
              <WorkoutSummaryCard
                date={selectedDate}
                today={today}
                workout={selectedWorkout}
                onPress={() => setView('week')}
              />
            </View>
          )}
        </FadeIn>
      </ScrollView>

      <WorkoutEditorSheet
        workout={editor.workout}
        visible={editor.visible}
        contentKey={editor.openCount}
        plan={plan}
        profile={profile}
        onSave={handleSaveEdit}
        onReset={handleResetEdit}
        onDismiss={closeEditor}
        onClosed={handleEditorClosed}
        reduceMotion={reduceMotion}
      />

      <ZoneGuideSheet
        visible={zoneGuideVisible}
        easyPace={easyPace}
        onDismiss={() => setZoneGuideVisible(false)}
        reduceMotion={reduceMotion}
      />
    </>
  );
}

/** What the card shows for a workout, to notice when an edit changes it. */
function workoutContent(workout?: Workout) {
  return workout
    ? `${workout.type}:${workout.edited ? 1 : 0}:${Math.round(totalDuration(workout))}:${Math.round(totalDistance(workout))}`
    : '';
}

/**
 * A quick pop when the same workout's content changes (an edit or a
 * reset), so the card visibly takes the new values. Switching to another
 * day does not pulse.
 */
function Pulse({
  id,
  content,
  reduceMotion,
  children,
}: {
  id?: string;
  content: string;
  reduceMotion: boolean;
  children: React.ReactNode;
}) {
  const pop = useRef(new Animated.Value(1)).current;
  const previous = useRef({ id, content });

  useEffect(() => {
    const before = previous.current;
    previous.current = { id, content };
    if (reduceMotion || before.id !== id || before.content === content) return;
    pop.setValue(0);
    const animation = Animated.spring(pop, {
      toValue: 1,
      ...motion.springBounce,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [id, content, reduceMotion, pop]);

  return (
    <Animated.View
      style={{
        opacity: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
        transform: [
          {
            scale: pop.interpolate({
              inputRange: [0, 1],
              outputRange: [0.96, 1],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

function ComingUpRow({
  workout,
  showDivider,
  onPress,
}: {
  workout: Workout;
  showDivider: boolean;
  onPress: () => void;
}) {
  const title = `${formatDayLabel(workout.date)} · ${displayName(workout)}`;
  const details = `${formatKm(totalDistance(workout))} · ${formatMinutes(
    totalDuration(workout),
  )}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${details}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        showDivider && styles.rowDivider,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.rowText}>
        <Text style={[typography.headline, styles.rowTitle]}>{title}</Text>
        <Text style={[typography.subheadline, styles.rowDetails]}>
          {details}
        </Text>
      </View>
      <Text
        importantForAccessibility="no"
        style={[typography.title2, styles.chevron]}
      >
        ›
      </Text>
    </Pressable>
  );
}

/** Fades (and slightly slides) a view in when it mounts. */
function FadeIn({
  reduceMotion,
  children,
}: {
  reduceMotion: boolean;
  children: React.ReactNode;
}) {
  const entrance = useEntranceAnimation({
    animate: true,
    reduceMotion,
    offsetY: 8,
  });
  return <Animated.View style={entrance}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxs,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.lg,
  },
  mikeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  mikeBubble: {
    flex: 1,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.xxs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  rowPressed: {
    opacity: 0.5,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: colors.textPrimary,
  },
  rowDetails: {
    color: colors.textSecondary,
  },
  chevron: {
    color: colors.textMuted,
  },
});
