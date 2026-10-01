import React, { useCallback, useMemo, useState } from 'react';
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
  planDayMessages,
  type PlanDayMessageKey,
} from '../coach/planOnboardingScript';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';
import {
  addMonths,
  formatDayLabel,
  isSameMonth,
  startOfMonth,
  type ISODate,
} from '../utils/dates';
import { colors, spacing, typography } from '../theme';
import ChatBubble from './ChatBubble';
import MikeAvatar from './MikeAvatar';
import { PlanMonthCalendar, PlanWeekStrip } from './PlanCalendar';
import SegmentedControl from './SegmentedControl';
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
  if (workout.status === 'skipped') return 'skipped';
  if (workout.type === 'rest') return 'rest';
  if (gentle) return 'gentle';
  if (isRunWalk(workout)) return 'runWalk';
  return workout.type;
}

type Props = {
  plan: Plan;
  today: ISODate;
  /** An injury hurts now: Mike reminds the user to take it easy. */
  gentle: boolean;
  reduceMotion: boolean;
  onStartWorkout: (workout: Workout) => void;
};

/** The training plan: Week and Month views of the user's workouts. */
export default function PlanOverview({
  plan,
  today,
  gentle,
  reduceMotion,
  onStartWorkout,
}: Props) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<PlanView>('week');
  const [selectedDate, setSelectedDate] = useState(today);
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
  const messageKey = mikeMessageKey(selectedWorkout, gentle);

  // Another month never contains the selection, so moving to it selects
  // its first workout (or its first day when nothing is planned there).
  const changeMonth = useCallback(
    (delta: -1 | 1) => {
      const month = addMonths(visibleMonth, delta);
      const firstWorkout = plan.workouts.find(
        (workout) =>
          isSameMonth(workout.date, month) && workout.type !== 'rest',
      );
      setSelectedDate(firstWorkout?.date ?? month);
    },
    [plan, visibleMonth],
  );

  const comingUp = upcomingWorkouts(
    plan,
    selectedDate > today ? selectedDate : today,
    COMING_UP_COUNT,
  );

  return (
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
        onChange={setView}
        reduceMotion={reduceMotion}
      />

      <FadeIn key={view} reduceMotion={reduceMotion}>
        {view === 'week' ? (
          <View style={styles.section}>
            <PlanWeekStrip
              selectedDate={selectedDate}
              today={today}
              workoutFor={workoutFor}
              onSelect={setSelectedDate}
            />

            <View style={styles.mikeRow}>
              <MikeAvatar />
              <View style={styles.mikeBubble}>
                {/* Keyed by message, so a new line pops in like a chat. */}
                <ChatBubble
                  key={messageKey}
                  text={planDayMessages[messageKey]}
                  sender="mike"
                  reduceMotion={reduceMotion}
                />
              </View>
            </View>

            <WorkoutCard
              date={selectedDate}
              today={today}
              workout={selectedWorkout}
              onStart={
                selectedWorkout
                  ? () => onStartWorkout(selectedWorkout)
                  : undefined
              }
              // TODO: open the workout editor once it exists.
              onEdit={undefined}
            />

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
                    onPress={() => setSelectedDate(workout.date)}
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
              onSelect={setSelectedDate}
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
