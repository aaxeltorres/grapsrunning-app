import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, motion, radius, spacing, typography } from '../theme';

const PRESSED_SCALE = 0.96;
const BADGE_SIZE = 22;

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** 'checkbox' for multi-select, 'radio' for single choice. */
  role: 'checkbox' | 'radio';
  /** 'square': centered label (day tiles). 'row': label left, check right. */
  variant?: 'square' | 'row';
  style?: ViewStyle;
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
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={() => springTo(PRESSED_SCALE)}
      onPressOut={() => springTo(1)}
      style={style}
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
          numberOfLines={2}
          style={[
            typography.headline,
            styles.label,
            isSquare && styles.squareLabel,
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
    height: 72,
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
  label: {
    flex: 1,
    color: colors.textPrimary,
  },
  squareLabel: {
    flex: 0,
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
