import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import IconPlaceholder from './IconPlaceholder';

type Props = {
  label: string;
  onPress?: () => void;
};

/**
 * Generic social auth button ("Continue with Google" / "Continue with Apple").
 * Icon is a placeholder — swap in the provider's official mark for release.
 */
export default function SocialButton({ label, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.base, pressed && styles.pressed]}
    >
      <IconPlaceholder size={20} shape="square" />
      <Text style={[typography.headline, styles.label]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.white,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    color: colors.black,
  },
});
