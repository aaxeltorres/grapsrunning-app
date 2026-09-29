import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  ViewStyle,
  ActivityIndicator,
  StyleProp,
  Animated,
} from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Variant = 'primary' | 'secondary' | 'outline' | 'runPause' | 'runFinish';
type Appearance = 'light' | 'dark';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  /**
  * Theme of the surface the button sits on. Used by the outline and run
  * variants when no animation value is provided.
   */
  appearance?: Appearance;
  /**
  * Animated theme progress (0 = light, 1 = dark). Pass the same value the
  * screen uses for its background so button colors transition in sync.
   */
  appearanceAnim?: Animated.Value;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  leftAdornment?: React.ReactNode;
};

/** Label colors for the theme aware (outline) variant. */
const themedLabelColors: Record<Appearance, string> = {
  light: colors.textPrimary,
  dark: colors.runDarkText,
};

export default function Button({
  label,
  onPress,
  variant = 'primary',
  appearance = 'light',
  appearanceAnim,
  disabled = false,
  loading = false,
  style,
  leftAdornment,
}: Props) {
  const [pressed, setPressed] = useState(false);
  const outlineLabelColor = appearanceAnim
    ? appearanceAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [themedLabelColors.light, themedLabelColors.dark],
      })
    : themedLabelColors[appearance];

  const outlineBorderColor = appearanceAnim
    ? appearanceAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.divider, colors.runDarkText],
      })
    : appearance === 'dark' ? colors.runDarkText : colors.divider;

  const runPauseColor = appearanceAnim
    ? appearanceAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.black, colors.white],
      })
    : appearance === 'dark' ? colors.white : colors.black;

  const runFinishBackgroundColor = appearanceAnim
    ? appearanceAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.white, colors.statOrange],
      })
    : appearance === 'dark' ? colors.statOrange : colors.white;

  const runFinishLabelColor = appearanceAnim
    ? appearanceAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.statOrange, colors.white],
      })
    : appearance === 'dark' ? colors.white : colors.statOrange;

  const runFinishBorderColor = appearanceAnim
    ? appearanceAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.statOrange, colors.statOrange],
      })
    : colors.statOrange;

  const labelColor =
    variant === 'runPause'
      ? runPauseColor
      : variant === 'runFinish'
        ? runFinishLabelColor
        : variant === 'outline'
          ? outlineLabelColor
          : variant === 'primary'
            ? colors.white
            : colors.textPrimary;

  const animatedStyle = variant === 'outline'
    ? { borderColor: outlineBorderColor }
    : variant === 'runPause'
      ? { borderColor: runPauseColor }
      : variant === 'runFinish'
          ? {
              backgroundColor: runFinishBackgroundColor,
              borderColor: runFinishBorderColor,
            }
        : {};

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled || loading}
      style={[
        styles.base,
        variantStyles[variant],
        animatedStyle,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
        style,
      ]}
    >
      {leftAdornment}
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.white : themedLabelColors[appearance]} />
      ) : (
        <Animated.Text style={[typography.headline, { color: labelColor }]}>
          {label}
        </Animated.Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 52,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
});

const variantStyles: Record<Variant, ViewStyle> = {
  primary: {
    backgroundColor: colors.black,
  },
  secondary: {
    backgroundColor: colors.surfaceGray,
  },
  outline: {
    // Transparent so the same outline reads on light and dark surfaces —
    // the active run screen animates its background between the two.
    backgroundColor: 'transparent',
    borderWidth: 1,
    // Light gray: subtle on light themes, high contrast on dark ones.
    borderColor: colors.divider,
  },
  runPause: {
    height: 56,
    borderRadius: radius.button,
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  runFinish: {
    height: 56,
    borderRadius: radius.button,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.statOrange,
  },
};
