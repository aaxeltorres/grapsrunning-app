import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

type Props = {
  label: string;
  /** Left out for an action row: only the label and the chevron show. */
  value?: string;
  /** Draws a divider line above the row. */
  divider?: boolean;
  /** Locks the row and hides the chevron. */
  disabled?: boolean;
  onPress: () => void;
};

/**
 * One answer in a list: the question above its current value, with a
 * chevron. Tapping it changes the answer. Used by the onboarding recap
 * card and the profile screen.
 */
export default function AnswerRow({
  label,
  value,
  divider = false,
  disabled = false,
  onPress,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value === undefined ? label : `${label}: ${value}`}
      accessibilityHint={
        disabled || value === undefined ? undefined : 'Change your answer'
      }
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        divider && styles.divider,
        pressed && styles.pressed,
      ]}
    >
      {/* Label above the value, so lists like the training days get the
          full width instead of wrapping mid-list. */}
      <View style={styles.text}>
        {value === undefined ? (
          <Text style={[typography.body, styles.value]}>{label}</Text>
        ) : (
          <>
            <Text style={[typography.subheadline, styles.label]}>{label}</Text>
            <Text style={[typography.body, styles.value]}>{value}</Text>
          </>
        )}
      </View>
      {!disabled && (
        <Text
          importantForAccessibility="no"
          style={[typography.headline, styles.chevron]}
        >
          ›
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingVertical: spacing.xs,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  pressed: {
    opacity: 0.5,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: colors.textSecondary,
  },
  value: {
    color: colors.textPrimary,
  },
  chevron: {
    color: colors.textMuted,
  },
});
