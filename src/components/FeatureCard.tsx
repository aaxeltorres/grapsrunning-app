import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { radius, spacing, typography, colors } from '../theme';
import IconPlaceholder from './IconPlaceholder';

type Props = {
  title: string;
  subtitle?: string;
  backgroundColor: string;
  iconBackgroundColor?: string;
  onPress?: () => void;
};

/**
 * Large tappable card used on the Home dashboard
 * (AI Coach Mike / Routes / Plan / Stats).
 */
export default function FeatureCard({
  title,
  subtitle,
  backgroundColor,
  iconBackgroundColor = colors.white,
  onPress,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.textBlock}>
        <Text style={[typography.headline, styles.title]}>{title}</Text>
        {subtitle ? (
          <Text style={[typography.subheadline, styles.subtitle]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <IconPlaceholder size={40} backgroundColor={iconBackgroundColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  pressed: {
    opacity: 0.85,
  },
  textBlock: {
    flexShrink: 1,
    paddingRight: spacing.md,
  },
  title: {
    color: colors.black,
    letterSpacing: 0.3,
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
});
