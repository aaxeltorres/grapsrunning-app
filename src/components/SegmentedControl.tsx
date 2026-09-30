import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { colors, motion, radius, spacing, typography } from '../theme';
import { lightImpact } from '../utils/haptics';

const INSET = 2;

type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  reduceMotion?: boolean;
  style?: ViewStyle;
};

/** iOS-style segmented control with a sliding thumb. */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  reduceMotion = false,
  style,
}: Props<T>) {
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const position = useRef(new Animated.Value(index)).current;

  useEffect(() => {
    if (reduceMotion) {
      position.setValue(index);
      return;
    }
    const spring = Animated.spring(position, {
      toValue: index,
      ...motion.springPop,
      useNativeDriver: true,
    });
    spring.start();
    return () => spring.stop();
  }, [index, reduceMotion, position]);

  const segmentWidth = width > 0 ? (width - INSET * 2) / options.length : 0;

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.track, style]}
      onLayout={(event: LayoutChangeEvent) =>
        setWidth(event.nativeEvent.layout.width)
      }
    >
      {segmentWidth > 0 && (
        <Animated.View
          style={[
            styles.thumb,
            {
              width: segmentWidth,
              transform: [
                {
                  translateX: position.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, segmentWidth],
                  }),
                },
              ],
            },
          ]}
        />
      )}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              lightImpact();
              onChange(option.value);
            }}
            style={styles.segment}
          >
            <Text
              style={[
                typography.subheadline,
                styles.label,
                selected && styles.labelSelected,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: INSET,
    borderRadius: radius.sm + INSET,
    backgroundColor: colors.surfaceGray,
  },
  thumb: {
    position: 'absolute',
    top: INSET,
    bottom: INSET,
    left: INSET,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  segment: {
    flex: 1,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxs + 2,
  },
  label: {
    color: colors.textSecondary,
    fontWeight: '500',
  },
  labelSelected: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
