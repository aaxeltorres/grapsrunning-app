import React, { useCallback, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import {
  displayName,
  keyPace,
  totalDistance,
  totalDuration,
  type Workout,
} from '../coach/plan';
import { runModeMessage, type RunModeMessageKey } from '../coach/planOnboardingScript';
import { loadCurrentPlan } from '../storage/planSync';
import { workoutActuals } from '../run/planResult';
import { RUN_MODES, type RunModeId } from '../run/runModes';
import { todayRunState, type TodayRunState } from '../run/todayWorkout';
import { formatDayLabel, todayISO } from '../utils/dates';
import { lightImpact } from '../utils/haptics';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors, radius, spacing, typography } from '../theme';
import TopBar from '../components/TopBar';
import MikeAvatar from '../components/MikeAvatar';
import ChatBubble from '../components/ChatBubble';
import BottomSheet from '../components/BottomSheet';
import Button from '../components/Button';
import { formatKm, formatMinutes, formatPace } from '../components/WorkoutCard';

type Props = NativeStackScreenProps<RootStackParamList, 'RunMode'>;

function messageKey(state: TodayRunState): RunModeMessageKey {
  return state.kind === 'completed' && state.workout.status === 'partial'
    ? 'partial'
    : state.kind;
}

/**
 * Run mode selector, opened from "Start run" on Home. Quick start begins a
 * run, Set a goal opens the goal setup, Intervals opens the setup to build
 * your own reps and sets, and Today's workout runs the plan's
 * workout for today (the same flow as Start workout on the Plan). Without
 * a workout waiting, a sheet explains why and offers a quick run.
 */
export default function RunModeScreen({ navigation }: Props) {
  const reduceMotion = useReduceMotion();
  const [today] = useState(todayISO);
  const [state, setState] = useState<TodayRunState>({ kind: 'none' });
  const [sheetVisible, setSheetVisible] = useState(false);
  const enterStyle = useEntranceAnimation({
    animate: true,
    reduceMotion,
    offsetY: 12,
  });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      // Also adds a weekly plan's new week, so Today's workout is there.
      loadCurrentPlan()
        .catch(() => null)
        .then((plan) => {
          if (active) setState(todayRunState(plan, today));
        });
      return () => {
        active = false;
      };
    }, [today]),
  );

  // Replace, so a run flows back to Home through the results.
  const startQuickRun = () => navigation.replace('ActiveRun', { mode: 'quick' });
  const startWorkout = (workout: Workout) =>
    navigation.replace('ActiveRun', { mode: 'plan', workout });

  const handleSelect = (mode: RunModeId) => {
    lightImpact();
    if (mode === 'quick') {
      startQuickRun();
      return;
    }
    if (mode === 'goal') {
      navigation.navigate('GoalSetup');
      return;
    }
    if (mode === 'intervals') {
      navigation.navigate('IntervalSetup');
      return;
    }
    if (state.kind === 'planned') {
      startWorkout(state.workout);
      return;
    }
    setSheetVisible(true);
  };

  const planCard = <PlanModeCard state={state} onPress={() => handleSelect('plan')} />;
  const highlighted = state.kind === 'planned';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <TopBar title="Start run" onBack={() => navigation.goBack()} right={null} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.stack, enterStyle]}>
          <View style={styles.mikeRow}>
            <MikeAvatar />
            <View style={styles.mikeBubble}>
              <ChatBubble
                text={runModeMessage(messageKey(state), today)}
                sender="mike"
                animateOnMount={false}
                reduceMotion={reduceMotion}
              />
            </View>
          </View>

          {highlighted && planCard}
          <ModeCard mode="quick" onPress={() => handleSelect('quick')} />
          {!highlighted && planCard}
          <ModeCard mode="goal" onPress={() => handleSelect('goal')} />
          <ModeCard mode="intervals" onPress={() => handleSelect('intervals')} />
        </Animated.View>
      </ScrollView>

      <BottomSheet
        visible={sheetVisible}
        onDismiss={() => setSheetVisible(false)}
        dragAnywhere
        reduceMotion={reduceMotion}
      >
        <NoWorkoutSheet
          state={state}
          onQuickStart={() => {
            setSheetVisible(false);
            startQuickRun();
          }}
          onClose={() => setSheetVisible(false)}
        />
      </BottomSheet>
    </SafeAreaView>
  );
}

/** Why Today's workout can't start a planned workout, and what to do instead. */
function NoWorkoutSheet({
  state,
  onQuickStart,
  onClose,
}: {
  state: TodayRunState;
  onQuickStart: () => void;
  onClose: () => void;
}) {
  if (state.kind === 'completed') {
    const partial = state.workout.status === 'partial';
    const name = displayName(state.workout);
    return (
      <>
        <Text style={[typography.title2, styles.sheetTitle]}>
          {partial ? 'You did part of it' : 'Already done today'}
        </Text>
        <Text style={[typography.body, styles.sheetBody]}>
          {partial
            ? `You got part of ${name} in today. Feel like more? Go for a free run.`
            : `You finished ${name} today. Enjoy the rest, or go for a free run.`}
        </Text>
        <View style={styles.sheetActions}>
          <Button label="Free run" variant="accent" onPress={onQuickStart} />
          <Button label="Not now" variant="secondary" onPress={onClose} />
        </View>
      </>
    );
  }

  const isRest = state.kind === 'rest';
  const next = state.kind === 'rest' || state.kind === 'none' ? state.next : undefined;
  return (
    <>
      <Text style={[typography.title2, styles.sheetTitle]}>
        {isRest ? 'Rest day' : 'No workout today'}
      </Text>
      <Text style={[typography.body, styles.sheetBody]}>
        {isRest
          ? 'Nothing planned today: rest is part of the training. Feel like moving anyway? Go for a free run.'
          : 'Your plan has no workout for today. You can still go for a free run.'}
      </Text>
      {next && (
        <Text style={[typography.subheadline, styles.sheetNext]}>{nextLine(next)}</Text>
      )}
      <View style={styles.sheetActions}>
        <Button label="Quick start" variant="accent" onPress={onQuickStart} />
        <Button label="Not now" variant="secondary" onPress={onClose} />
      </View>
    </>
  );
}

function ModeCard({
  mode,
  onPress,
}: {
  mode: RunModeId;
  onPress: () => void;
}) {
  const { name, description } = RUN_MODES[mode];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${description}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        styles.quietCard,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.cardText}>
        <Text style={[typography.headline, styles.title]}>{name}</Text>
        <Text style={[typography.subheadline, styles.quietBody]}>
          {description}
        </Text>
      </View>
      <Text importantForAccessibility="no" style={[typography.title2, styles.chevron]}>
        ›
      </Text>
    </Pressable>
  );
}

/** "Wed 2 · 6 × 400 m" */
function nextLine(workout: Workout) {
  return `Next: ${formatDayLabel(workout.date)} · ${displayName(workout)}`;
}

/** The "Today's workout" card in each state of the plan. */
function PlanModeCard({
  state,
  onPress,
}: {
  state: TodayRunState;
  onPress: () => void;
}) {
  const name = RUN_MODES.plan.name;

  if (state.kind === 'planned') {
    const { workout } = state;
    const pace = keyPace(workout);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}. ${displayName(workout)}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          styles.workoutCard,
          styles.workoutCardColumn,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.headingRow}>
          <Text style={[typography.subheadline, styles.heading]}>{name}</Text>
          {workout.edited && (
            <View style={styles.pill}>
              <Text style={[typography.caption, styles.pillText]}>Edited</Text>
            </View>
          )}
        </View>
        <Text style={[typography.largeTitle, styles.title]}>
          {displayName(workout)}
        </Text>
        <View style={styles.metrics}>
          <Metric value={formatKm(totalDistance(workout))} label="distance" />
          <Metric value={formatMinutes(totalDuration(workout))} label="time" />
          {pace !== null && <Metric value={formatPace(pace)} label="pace /km" />}
        </View>
      </Pressable>
    );
  }

  if (state.kind === 'completed') {
    const { workout } = state;
    const partial = workout.status === 'partial';
    const actual = workoutActuals(workout);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}. ${displayName(workout)}, ${partial ? 'partially completed' : 'completed'}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          styles.quietCard,
          styles.workoutCardColumn,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.headingRow}>
          <Text style={[typography.subheadline, styles.quietHeading]}>{name}</Text>
          <View style={[styles.pill, partial ? styles.partialPill : styles.donePill]}>
            <Text style={[typography.caption, styles.pillText]}>
              {partial ? 'Partial' : 'Completed ✓'}
            </Text>
          </View>
        </View>
        <Text style={[typography.headline, styles.title]}>
          {displayName(workout)}
        </Text>
        <Text style={[typography.subheadline, styles.quietBody]}>
          {`${formatKm(actual.distanceMeters)} · ${formatMinutes(actual.durationSeconds)}`}
        </Text>
      </Pressable>
    );
  }

  const isRest = state.kind === 'rest';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${isRest ? 'Rest day' : 'No workout planned'}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        styles.quietCard,
        styles.workoutCardColumn,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[typography.subheadline, styles.quietHeading]}>{name}</Text>
      <Text style={[typography.headline, styles.title]}>
        {isRest ? 'Rest day' : 'No workout planned'}
      </Text>
      {state.next && (
        <Text style={[typography.subheadline, styles.quietBody]}>
          {nextLine(state.next)}
        </Text>
      )}
    </Pressable>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label.replace(' /km', ' per kilometer')}: ${value}`}
    >
      <Text style={[typography.title2, styles.title]}>{value}</Text>
      <Text style={[typography.subheadline, styles.quietBody]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  stack: {
    gap: spacing.md,
  },
  mikeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  mikeBubble: {
    flex: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  workoutCardColumn: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: spacing.xxs,
  },
  workoutCard: {
    backgroundColor: colors.cardPlanBg,
  },
  quietCard: {
    backgroundColor: colors.surfaceGray,
  },
  pressed: {
    opacity: 0.85,
  },
  cardText: {
    flex: 1,
    gap: spacing.xxs,
  },
  chevron: {
    color: colors.textMuted,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  heading: {
    color: colors.planCardAccent,
    fontWeight: '600',
  },
  quietHeading: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  title: {
    color: colors.textPrimary,
  },
  quietBody: {
    color: colors.textSecondary,
  },
  metrics: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.sm,
  },
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    backgroundColor: colors.planSegmentMuted,
  },
  donePill: {
    backgroundColor: colors.statGreenBg,
  },
  partialPill: {
    backgroundColor: colors.divider,
  },
  pillText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  sheetTitle: {
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  sheetBody: {
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  sheetNext: {
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  sheetActions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
