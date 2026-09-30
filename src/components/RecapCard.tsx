import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { RecapRow } from '../coach/conversation';
import type { QuestionId } from '../coach/runnerProfile';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';
import { colors, radius, spacing, typography } from '../theme';
import Button from './Button';

type Props = {
  title: string;
  rows: RecapRow[];
  confirmLabel: string;
  /** Once confirmed, rows and the button are locked. */
  confirmed: boolean;
  /** False while something else is animating (e.g. Mike is typing). */
  canConfirm: boolean;
  onRowPress: (questionId: QuestionId) => void;
  onConfirm: () => void;
  animateOnMount?: boolean;
  reduceMotion?: boolean;
};

/**
 * Summary of the user's onboarding answers, shown in the chat. Tapping a
 * row edits that answer; the button confirms them all.
 */
function RecapCard({
  title,
  rows,
  confirmLabel,
  confirmed,
  canConfirm,
  onRowPress,
  onConfirm,
  animateOnMount = true,
  reduceMotion = false,
}: Props) {
  const entrance = useEntranceAnimation({
    animate: animateOnMount,
    reduceMotion,
    offsetY: 16,
    fromScale: 0.96,
  });

  return (
    <Animated.View style={[styles.card, entrance]}>
      <Text accessibilityRole="header" style={[typography.headline, styles.title]}>
        {title}
      </Text>

      <View style={styles.rows}>
        {rows.map((row, index) => (
          <Pressable
            key={row.questionId}
            accessibilityRole="button"
            accessibilityLabel={`${row.label}: ${row.value}`}
            accessibilityHint={confirmed ? undefined : 'Change your answer'}
            accessibilityState={{ disabled: confirmed }}
            disabled={confirmed}
            onPress={() => onRowPress(row.questionId)}
            style={({ pressed }) => [
              styles.row,
              index > 0 && styles.rowDivider,
              pressed && styles.rowPressed,
            ]}
          >
            <Text style={[typography.subheadline, styles.label]}>
              {row.label}
            </Text>
            <Text style={[typography.body, styles.value]}>{row.value}</Text>
            {!confirmed && (
              <Text
                importantForAccessibility="no"
                style={[typography.headline, styles.chevron]}
              >
                ›
              </Text>
            )}
          </Pressable>
        ))}
      </View>

      <Button
        label={confirmLabel}
        onPress={onConfirm}
        disabled={confirmed || !canConfirm}
        style={styles.button}
      />
    </Animated.View>
  );
}

export default React.memo(RecapCard);

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    borderRadius: radius.lg,
    borderTopLeftRadius: radius.sm,
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
    padding: spacing.md,
    transformOrigin: 'left top',
  },
  title: {
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  rows: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingVertical: spacing.xs,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  rowPressed: {
    opacity: 0.5,
  },
  label: {
    color: colors.textSecondary,
    flexShrink: 0,
    maxWidth: '45%',
  },
  value: {
    flex: 1,
    color: colors.textPrimary,
    textAlign: 'right',
  },
  chevron: {
    color: colors.textMuted,
  },
  button: {
    alignSelf: 'stretch',
  },
});
