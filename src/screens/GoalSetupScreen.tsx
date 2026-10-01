import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import {
  GOAL_LABELS,
  GOAL_METRICS,
  deriveGoal,
  formatGoalValue,
  goalLimits,
  goalValue,
  validateGoal,
  withGoalValue,
  type GoalIssue,
  type GoalMetric,
  type RunGoal,
} from '../run/goals';
import { lightImpact } from '../utils/haptics';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors, radius, spacing, typography } from '../theme';
import TopBar from '../components/TopBar';
import Button from '../components/Button';
import GoalPickerSheet from '../components/GoalPickerSheet';

type Props = NativeStackScreenProps<RootStackParamList, 'GoalSetup'>;

/** Grey hint for the goal two others imply. */
const DERIVED_HINTS: Record<GoalMetric, string> = {
  distance: 'estimated distance',
  time: 'estimated time',
  pace: 'needed pace',
};

/** One short line per blocking problem. */
function issueText(issue: GoalIssue, goal: RunGoal): string | null {
  switch (issue.kind) {
    case 'empty':
      return null; // the disabled Start button says enough
    case 'outOfRange': {
      const { min, max } = goalLimits(issue.metric);
      return `${GOAL_LABELS[issue.metric]} must be between ${formatGoalValue(
        issue.metric,
        min,
      )} and ${formatGoalValue(issue.metric, max)}.`;
    }
    case 'impossible': {
      const { min, max } = goalLimits(issue.metric);
      if (issue.metric === 'pace') {
        return issue.tooHigh
          ? `That needs a pace slower than ${formatGoalValue('pace', max)}.`
          : `That needs a pace faster than ${formatGoalValue('pace', min)}.`;
      }
      const limit = formatGoalValue(issue.metric, issue.tooHigh ? max : min);
      return `That works out to ${issue.tooHigh ? 'more' : 'less'} than ${limit}.`;
    }
    case 'mismatch':
      return `${formatGoalValue('distance', goal.distanceMeters!)} at ${formatGoalValue(
        'pace',
        goal.paceSecPerKm!,
      )} takes ${formatGoalValue('time', issue.expectedTime)}, not ${formatGoalValue(
        'time',
        goal.durationSeconds!,
      )}.`;
  }
}

/**
 * Goal run setup: distance, time and pace, each optional. Two goals show
 * the third they imply; three that don't agree block the start.
 */
export default function GoalSetupScreen({ navigation }: Props) {
  const reduceMotion = useReduceMotion();
  const [goal, setGoal] = useState<RunGoal>({});
  const [editing, setEditing] = useState<GoalMetric | null>(null);

  const derived = deriveGoal(goal);
  const issues = validateGoal(goal);
  const messages = issues
    .map((issue) => issueText(issue, goal))
    .filter((text): text is string => text !== null);
  const mismatch = issues.find((issue) => issue.kind === 'mismatch');

  const handleSet = (metric: GoalMetric, value: number) => {
    setGoal((current) => withGoalValue(current, metric, value));
    setEditing(null);
  };

  const handleClear = (metric: GoalMetric) => {
    setGoal((current) => withGoalValue(current, metric, undefined));
    setEditing(null);
  };

  const handleStart = () => {
    lightImpact();
    navigation.replace('ActiveRun', { mode: 'goal', goal });
  };

  const sheetValue =
    editing === null
      ? undefined
      : goalValue(goal, editing) ??
        (derived?.metric === editing ? derived.value : undefined);

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
      <TopBar title="Set a goal" onBack={() => navigation.goBack()} right={null} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[typography.body, styles.intro]}>
          Set any goal you like. Leave the rest empty.
        </Text>

        {GOAL_METRICS.map((metric) => {
          const value = goalValue(goal, metric);
          const isDerived = value === undefined && derived?.metric === metric;
          return (
            <Pressable
              key={metric}
              accessibilityRole="button"
              accessibilityHint={`Sets your ${GOAL_LABELS[metric].toLowerCase()} goal`}
              onPress={() => {
                lightImpact();
                setEditing(metric);
              }}
              style={({ pressed }) => [
                styles.card,
                value !== undefined && styles.cardSet,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.cardText}>
                <Text style={[typography.subheadline, styles.cardLabel]}>
                  {GOAL_LABELS[metric]}
                </Text>
                {value !== undefined ? (
                  <Text style={[typography.largeTitle, styles.cardValue]}>
                    {formatGoalValue(metric, value)}
                  </Text>
                ) : isDerived ? (
                  <Text style={[typography.title2, styles.cardDerived]}>
                    {`≈ ${formatGoalValue(metric, derived.value)} `}
                    <Text style={typography.subheadline}>{DERIVED_HINTS[metric]}</Text>
                  </Text>
                ) : (
                  <Text style={[typography.title2, styles.cardEmpty]}>Not set</Text>
                )}
              </View>
              <Text importantForAccessibility="no" style={[typography.title2, styles.chevron]}>
                ›
              </Text>
            </Pressable>
          );
        })}

        {messages.length > 0 && (
          <View style={styles.issues} accessibilityLiveRegion="polite">
            {messages.map((text) => (
              <Text key={text} style={[typography.subheadline, styles.issueText]}>
                {text}
              </Text>
            ))}
            {mismatch?.kind === 'mismatch' && (
              <Button
                label={`Use ${formatGoalValue('pace', mismatch.fixPace)}`}
                variant="outline"
                onPress={() =>
                  setGoal((current) => withGoalValue(current, 'pace', mismatch.fixPace))
                }
                style={styles.fixButton}
              />
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Start goal run"
          variant="accent"
          disabled={issues.length > 0}
          onPress={handleStart}
        />
      </View>

      <GoalPickerSheet
        metric={editing}
        initialValue={sheetValue}
        onSet={handleSet}
        onClear={handleClear}
        onDismiss={() => setEditing(null)}
        reduceMotion={reduceMotion}
      />
    </SafeAreaView>
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
    gap: spacing.md,
  },
  intro: {
    color: colors.textSecondary,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.lg,
    backgroundColor: colors.surfaceGray,
  },
  cardSet: {
    backgroundColor: colors.cardCoachBg,
  },
  pressed: {
    opacity: 0.85,
  },
  cardText: {
    flex: 1,
    gap: spacing.xxs,
  },
  cardLabel: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  cardValue: {
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  cardDerived: {
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  cardEmpty: {
    color: colors.textMuted,
  },
  chevron: {
    color: colors.textMuted,
  },
  issues: {
    gap: spacing.xs,
  },
  issueText: {
    color: colors.alertRedLight,
  },
  fixButton: {
    alignSelf: 'flex-start',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
});
