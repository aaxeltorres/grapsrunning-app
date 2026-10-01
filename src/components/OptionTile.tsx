import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, motion, radius, spacing, typography } from '../theme';

const PRESSED_SCALE = 0.96;
const BADGE_SIZE = 22;
// Day tiles are narrow (4 per row): cap Dynamic Type so labels still fit.
const SQUARE_MAX_FONT_SCALE = 1.4;

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** 'checkbox' for multi-select, 'radio' for single choice. */
  role: 'checkbox' | 'radio';
  /** 'square': centered label (day tiles). 'row': label left, check right. */
  variant?: 'square' | 'row';
  style?: ViewStyle;
  /** Dims the tile and blocks the press (an option that isn't available). */
  disabled?: boolean;
  /** Overrides the spoken label, e.g. to say why a tile is disabled. */
  accessibilityLabel?: string;
};

/**
 * Large tappable answer tile. Selected tiles turn iOS green with a
 * checkmark.
 */
export default function OptionTile({
  label,
  selected,
  onPress,
  role,
  variant = 'row',
  style,
  disabled = false,
  accessibilityLabel,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const springTo = (toValue: number) =>
    Animated.spring(scale, {
      toValue,
      ...motion.springPop,
      useNativeDriver: true,
    }).start();

  const isSquare = variant === 'square';

  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => springTo(PRESSED_SCALE)}
      onPressOut={() => springTo(1)}
      style={[style, disabled && styles.disabled]}
    >
      <Animated.View
        style={[
          styles.tile,
          isSquare ? styles.square : styles.row,
          selected && styles.selected,
          { transform: [{ scale }] },
        ]}
      >
        <Text
          numberOfLines={isSquare ? 1 : undefined}
          maxFontSizeMultiplier={isSquare ? SQUARE_MAX_FONT_SCALE : undefined}
          style={[
            typography.headline,
            styles.label,
            isSquare ? styles.squareLabel : styles.rowLabel,
            selected && styles.selectedLabel,
          ]}
        >
          {label}
        </Text>
        {(selected || !isSquare) && (
          <View
            style={[
              styles.badge,
              isSquare && styles.squareBadge,
              selected ? styles.badgeSelected : styles.badgeEmpty,
            ]}
          >
            {selected && <View style={styles.checkmark} />}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceGray,
  },
  square: {
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selected: {
    backgroundColor: colors.iosGreen,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    color: colors.textPrimary,
  },
  rowLabel: {
    flex: 1,
  },
  // No flex here: in a column a flex basis of 0 collapses the text to
  // zero height, which hid the day names.
  squareLabel: {
    textAlign: 'center',
  },
  selectedLabel: {
    color: colors.white,
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
  },
  badgeEmpty: {
    borderWidth: 1.5,
    borderColor: colors.sheetGrabber,
  },
  badgeSelected: {
    backgroundColor: colors.white,
  },
  // Drawn as a rotated corner so no icon set is needed.
  checkmark: {
    width: 6,
    height: 11,
    marginTop: -2,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.iosGreen,
    transform: [{ rotate: '45deg' }],
  },
});
