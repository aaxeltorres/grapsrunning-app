import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { lightImpact } from '../utils/haptics';

type Props = {
  label: string;
  onPress: () => void;
  selected?: boolean;
  accessibilityLabel?: string;
};

/** Compact pill to pick or apply one option (presets, suggested fixes). */
export default function Chip({ label, onPress, selected = false, accessibilityLabel }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={() => {
        lightImpact();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[typography.subheadline, styles.label, selected && styles.labelSelected]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceGray,
  },
  chipSelected: {
    backgroundColor: colors.iosBlue,
  },
  label: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  labelSelected: {
    color: colors.white,
  },
  pressed: {
    opacity: 0.85,
  },
});
