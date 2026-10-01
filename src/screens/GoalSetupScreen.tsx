import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import {
  EMPTY_GOAL_SETUP,
  GOAL_LABELS,
  GOAL_METRICS,
  clearGoalMetric,
  deriveGoal,
  formatSetupValue,
  goalFixes,
  goalLimits,
  goalValue,
  setGoalMetric,
  validateGoal,
  type GoalFix,
  type GoalIssue,
  type GoalMetric,
  type GoalSetup,
} from '../run/goals';
import { lightImpact } from '../utils/haptics';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors, radius, spacing, typography } from '../theme';
import TopBar from '../components/TopBar';
import Button from '../components/Button';
import Chip from '../components/Chip';
import GoalPickerSheet from '../components/GoalPickerSheet';

type Props = NativeStackScreenProps<RootStackParamList, 'GoalSetup'>;

/** Grey hint for the goal two others imply. */
const DERIVED_HINTS: Record<GoalMetric, string> = {
  distance: 'estimated distance',
  time: 'estimated time',
  pace: 'needed pace',
};

/** One short line per blocking problem. */
function issueText(issue: GoalIssue): string | null {
  switch (issue.kind) {
    case 'empty':
      return null; // the disabled Start button says enough
    case 'outOfRange': {
      const { min, max } = goalLimits(issue.metric);
      return `${GOAL_LABELS[issue.metric]} must be between ${formatSetupValue(
        issue.metric,
        min,
      )} and ${formatSetupValue(issue.metric, max)}.`;
    }
    case 'impossible': {
      const { min, max } = goalLimits(issue.metric);
      const need = formatSetupValue(issue.metric, issue.value);
      const limit = formatSetupValue(issue.metric, issue.tooHigh ? max : min);
      switch (issue.metric) {
        case 'pace':
          return `That would need ${need}, ${
            issue.tooHigh ? 'slower' : 'faster'
          } than the ${limit} limit.`;
        case 'time':
          return `That would take ${need}, ${
            issue.tooHigh ? 'longer' : 'shorter'
          } than the ${limit} limit.`;
        case 'distance':
          return `That would be ${need}, ${
            issue.tooHigh ? 'farther' : 'shorter'
          } than the ${limit} limit.`;
      }
    }
  }
}

/**
 * Goal run setup: distance, time and pace. Set any two and the third is
 * worked out; setting a third makes the one set least recently the
 * derived one. A derived value outside the allowed range blocks the start
 * and comes with fixes that are valid.
 */
export default function GoalSetupScreen({ navigation }: Props) {
  const reduceMotion = useReduceMotion();
  const [setup, setSetup] = useState<GoalSetup>(EMPTY_GOAL_SETUP);
  const [editing, setEditing] = useState<GoalMetric | null>(null);

  const { goal } = setup;
  const derived = deriveGoal(goal);
  const issues = validateGoal(goal);
  const fixes = goalFixes(goal);
  const messages = issues
    .map(issueText)
    .filter((text): text is string => text !== null);
  const derivedOff = issues.some((issue) => issue.kind === 'impossible');

  const handleSet = (metric: GoalMetric, value: number) => {
    setSetup((current) => setGoalMetric(current, metric, value));
    setEditing(null);
  };

  const handleClear = (metric: GoalMetric) => {
    setSetup((current) => clearGoalMetric(current, metric));
    setEditing(null);
  };

  const handleFix = (fix: GoalFix) =>
    setSetup((current) => setGoalMetric(current, fix.metric, fix.value));

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
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[typography.body, styles.intro]}>
          Set any two and the third is worked out for you.
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
                    {formatSetupValue(metric, value)}
                  </Text>
                ) : isDerived ? (
                  <Text
                    style={[
                      typography.title2,
                      styles.cardDerived,
                      derivedOff && styles.cardDerivedOff,
                    ]}
                  >
                    {`≈ ${formatSetupValue(metric, derived.value)} `}
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
      </ScrollView>

      <View style={styles.footer}>
        {messages.length > 0 && (
          <View style={styles.issues} accessibilityLiveRegion="polite">
            {messages.map((text) => (
              <Text key={text} style={[typography.subheadline, styles.issueText]}>
                {text}
              </Text>
            ))}
            {fixes.length > 0 && (
              <View style={styles.fixes}>
                {fixes.map((fix) => (
                  <Chip
                    key={fix.metric}
                    label={`Use ${formatSetupValue(fix.metric, fix.value)}`}
                    accessibilityLabel={`Set ${GOAL_LABELS[fix.metric].toLowerCase()} to ${formatSetupValue(fix.metric, fix.value)}`}
                    onPress={() => handleFix(fix)}
                  />
                ))}
              </View>
            )}
          </View>
        )}
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
        canClear={editing !== null && goalValue(goal, editing) !== undefined}
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
  // Only the cards scroll. `minHeight: 0` lets it shrink below its content
  // on web, so the footer below is never pushed off or drawn over.
  scroll: {
    flex: 1,
    minHeight: 0,
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
  cardDerivedOff: {
    color: colors.alertRedLight,
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
  fixes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  // The message, its fixes and Start stay in view on any screen height.
  footer: {
    flexShrink: 0,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
});
