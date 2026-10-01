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
import { planStorage } from '../storage/planStorage';
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

const MESSAGE_KEY: Record<TodayRunState['kind'], RunModeMessageKey> = {
  planned: 'planned',
  completed: 'completed',
  rest: 'rest',
  none: 'none',
};

/**
 * Run mode selector, opened from "Start run" on Home. Quick start begins a
 * run; the other modes are not built yet and show a "Coming soon" sheet.
 */
export default function RunModeScreen({ navigation }: Props) {
  const reduceMotion = useReduceMotion();
  const [today] = useState(todayISO);
  const [state, setState] = useState<TodayRunState>({ kind: 'none' });
  // `soonMode` outlives the sheet, so its text stays during the exit animation.
  const [soonMode, setSoonMode] = useState<RunModeId>('goal');
  const [soonVisible, setSoonVisible] = useState(false);
  const enterStyle = useEntranceAnimation({
    animate: true,
    reduceMotion,
    offsetY: 12,
  });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      planStorage
        .get()
        .catch(() => null)
        .then((plan) => {
          if (active) setState(todayRunState(plan, today));
        });
      return () => {
        active = false;
      };
    }, [today]),
  );

  const handleSelect = (mode: RunModeId) => {
    lightImpact();
    if (mode === 'quick') {
      // Replace, so the run flows back to Home through the results.
      navigation.replace('ActiveRun', { mode: 'quick' });
      return;
    }
    setSoonMode(mode);
    setSoonVisible(true);
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
                text={runModeMessage(MESSAGE_KEY[state.kind], today)}
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
        </Animated.View>
      </ScrollView>

      <BottomSheet
        visible={soonVisible}
        onDismiss={() => setSoonVisible(false)}
        reduceMotion={reduceMotion}
      >
        <Text style={[typography.title2, styles.soonTitle]}>
          {RUN_MODES[soonMode].name}
        </Text>
        <Text style={[typography.body, styles.soonBody]}>
          Coming soon. For now, Quick start is the way to run.
        </Text>
        <Button label="OK" onPress={() => setSoonVisible(false)} />
      </BottomSheet>
    </SafeAreaView>
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
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}. ${displayName(workout)}, completed`}
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
          <View style={[styles.pill, styles.donePill]}>
            <Text style={[typography.caption, styles.pillText]}>Completed ✓</Text>
          </View>
        </View>
        <Text style={[typography.headline, styles.title]}>
          {displayName(workout)}
        </Text>
        <Text style={[typography.subheadline, styles.quietBody]}>
          {`${formatKm(totalDistance(workout))} · ${formatMinutes(
            totalDuration(workout),
          )}`}
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
  pillText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  soonTitle: {
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  soonBody: {
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
});
