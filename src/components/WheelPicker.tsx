import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { selectionTick } from '../utils/haptics';

const ROW_HEIGHT = 44;
/** Odd, so one row sits in the middle. */
const VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;
const EDGE_PADDING = ROW_HEIGHT * Math.floor(VISIBLE_ROWS / 2);
const NUMBER_WHEEL_WIDTH = 120;
// Rows shrink and fade with their distance (in rows) from the center.
const ROW_OPACITY = [1, 0.45, 0.2];
const ROW_SCALE = [1, 0.88, 0.8];
// Fixed row height: cap Dynamic Type so labels never clip.
const MAX_FONT_SCALE = 1.3;
// Scrolling has stopped when no scroll event arrives for this long; the
// wheel then snaps to the nearest row (web has no snapToInterval).
const SETTLE_MS = 120;
// Longest a tap's scroll animation may take before scroll events count
// as user input again.
const PROGRAMMATIC_SCROLL_MS = 600;
const SCROLL_THROTTLE_MS = 16;
// The native driver doesn't exist on web.
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export type WheelItem<T extends string | number> = {
  value: T;
  label: string;
};

type Props<T extends string | number> = {
  items: WheelItem<T>[];
  selectedValue: T;
  onValueChange: (value: T) => void;
  /** Shown next to the wheel, e.g. "kg". Narrows the wheel for numbers. */
  unitLabel?: string;
  accessibilityLabel?: string;
};

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

/**
 * Apple-style wheel built from plain React Native views, so it looks the
 * same on iOS and web: snaps to rows, a selection band in the middle,
 * rows fading toward the edges and a haptic tick on every row change.
 * Scroll or tap a row to pick it.
 *
 * The wheel owns its position: `selectedValue` only moves it when the
 * value changes from outside, never when the parent echoes back a value
 * the wheel itself just reported.
 */
export default function WheelPicker<T extends string | number>({
  items,
  selectedValue,
  onValueChange,
  unitLabel,
  accessibilityLabel,
}: Props<T>) {
  const scrollRef = useRef<ScrollView>(null);
  const lastIndex = Math.max(0, items.length - 1);
  const indexOf = useCallback(
    (value: T) => Math.max(0, items.findIndex((item) => item.value === value)),
    [items],
  );

  // Centered row. A ref updates synchronously during scrolling; the state
  // copy only restyles the centered label.
  const initialIndex = indexOf(selectedValue);
  const indexRef = useRef(initialIndex);
  const [centerIndex, setCenterIndex] = useState(initialIndex);
  const scrollY = useRef(new Animated.Value(initialIndex * ROW_HEIGHT))
    .current;

  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Set while a tap or an outside change scrolls the wheel, so the rows it
  // passes on the way are not reported as selections.
  const targetIndexRef = useRef<number | null>(null);
  const targetTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const offsetRef = useRef(initialIndex * ROW_HEIGHT);

  useEffect(
    () => () => {
      clearTimeout(targetTimerRef.current);
      clearTimeout(settleTimerRef.current);
    },
    [],
  );

  const commit = useCallback((index: number, { haptic = true } = {}) => {
    if (index === indexRef.current) return;
    indexRef.current = index;
    setCenterIndex(index);
    if (haptic) selectionTick();
    const item = itemsRef.current[index];
    if (item) onValueChangeRef.current(item.value);
  }, []);

  const scrollToIndex = useCallback((index: number, animated: boolean) => {
    if (animated) {
      targetIndexRef.current = index;
      clearTimeout(targetTimerRef.current);
      targetTimerRef.current = setTimeout(() => {
        targetIndexRef.current = null;
      }, PROGRAMMATIC_SCROLL_MS);
    }
    scrollRef.current?.scrollTo({ y: index * ROW_HEIGHT, animated });
  }, []);

  // Outside changes only (e.g. a different question): our own reports
  // come back equal to `indexRef` and are ignored, so the wheel is never
  // pulled back to an older value while the user scrolls.
  useEffect(() => {
    const index = indexOf(selectedValue);
    if (index === indexRef.current) return;
    indexRef.current = index;
    setCenterIndex(index);
    scrollToIndex(index, false);
  }, [selectedValue, indexOf, scrollToIndex]);

  // Initial position. `contentOffset` covers iOS; web needs a scrollTo.
  const handleLayout = useCallback(() => {
    scrollRef.current?.scrollTo({
      y: indexRef.current * ROW_HEIGHT,
      animated: false,
    });
  }, []);

  const settle = useCallback(() => {
    targetIndexRef.current = null;
    const index = clamp(Math.round(offsetRef.current / ROW_HEIGHT), 0, lastIndex);
    commit(index);
    if (Math.abs(offsetRef.current - index * ROW_HEIGHT) > 0.5) {
      scrollToIndex(index, true);
    }
  }, [commit, lastIndex, scrollToIndex]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      offsetRef.current = y;
      const index = clamp(Math.round(y / ROW_HEIGHT), 0, lastIndex);

      const target = targetIndexRef.current;
      if (target !== null) {
        if (index === target && Math.abs(y - target * ROW_HEIGHT) < 1) {
          targetIndexRef.current = null;
        }
      } else {
        commit(index);
      }

      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(settle, SETTLE_MS);
    },
    [commit, lastIndex, settle],
  );

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: USE_NATIVE_DRIVER,
        listener: handleScroll,
      }),
    [scrollY, handleScroll],
  );

  // A finger on the wheel takes over from a tap's animation.
  const handleDragStart = useCallback(() => {
    targetIndexRef.current = null;
  }, []);

  const handleRowPress = useCallback(
    (index: number) => {
      commit(index);
      scrollToIndex(index, true);
    },
    [commit, scrollToIndex],
  );

  const handleAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const delta = event.nativeEvent.actionName === 'increment' ? 1 : -1;
      const index = clamp(indexRef.current + delta, 0, lastIndex);
      commit(index);
      scrollToIndex(index, false);
    },
    [commit, lastIndex, scrollToIndex],
  );

  const isNumber = unitLabel !== undefined;
  const centerLabel = items[centerIndex]?.label ?? '';

  const wheel = (
    <Animated.ScrollView
      ref={scrollRef}
      style={isNumber ? styles.numberWheel : styles.fullWheel}
      contentContainerStyle={styles.content}
      contentOffset={{ x: 0, y: initialIndex * ROW_HEIGHT }}
      snapToInterval={ROW_HEIGHT}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={SCROLL_THROTTLE_MS}
      nestedScrollEnabled
      onScroll={onScroll}
      onScrollBeginDrag={handleDragStart}
      onLayout={handleLayout}
    >
      {items.map((item, index) => (
        <WheelRow
          key={String(item.value)}
          label={item.label}
          index={index}
          scrollY={scrollY}
          centered={index === centerIndex}
          isNumber={isNumber}
          onPress={handleRowPress}
        />
      ))}
    </Animated.ScrollView>
  );

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{
        text: isNumber ? `${centerLabel} ${unitLabel}` : centerLabel,
      }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={handleAccessibilityAction}
      style={styles.container}
    >
      <View pointerEvents="none" style={styles.band} />
      {isNumber ? (
        // Number centered, unit to its right, like the iOS timer wheels.
        <View style={styles.numberRow}>
          <View style={styles.side} />
          {wheel}
          <View style={styles.side} pointerEvents="none">
            <Text
              maxFontSizeMultiplier={MAX_FONT_SCALE}
              style={[typography.headline, styles.unit]}
            >
              {unitLabel}
            </Text>
          </View>
        </View>
      ) : (
        wheel
      )}
    </View>
  );
}

type RowProps = {
  label: string;
  index: number;
  scrollY: Animated.Value;
  centered: boolean;
  isNumber: boolean;
  onPress: (index: number) => void;
};

const WheelRow = React.memo(function WheelRow({
  label,
  index,
  scrollY,
  centered,
  isNumber,
  onPress,
}: RowProps) {
  const center = index * ROW_HEIGHT;
  const inputRange = [
    center - ROW_HEIGHT * 2,
    center - ROW_HEIGHT,
    center,
    center + ROW_HEIGHT,
    center + ROW_HEIGHT * 2,
  ];
  const opacity = scrollY.interpolate({
    inputRange,
    outputRange: [ROW_OPACITY[2], ROW_OPACITY[1], ROW_OPACITY[0], ROW_OPACITY[1], ROW_OPACITY[2]],
    extrapolate: 'clamp',
  });
  const scale = scrollY.interpolate({
    inputRange,
    outputRange: [ROW_SCALE[2], ROW_SCALE[1], ROW_SCALE[0], ROW_SCALE[1], ROW_SCALE[2]],
    extrapolate: 'clamp',
  });

  return (
    <Pressable
      onPress={() => onPress(index)}
      importantForAccessibility="no"
      style={styles.row}
    >
      <Animated.Text
        numberOfLines={1}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={[
          isNumber ? typography.title2 : typography.headline,
          styles.rowLabel,
          centered && styles.centeredLabel,
          { opacity, transform: [{ scale }] },
        ]}
      >
        {label}
      </Animated.Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    height: WHEEL_HEIGHT,
    justifyContent: 'center',
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: EDGE_PADDING,
    height: ROW_HEIGHT,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceGray,
  },
  fullWheel: {
    height: WHEEL_HEIGHT,
    alignSelf: 'stretch',
  },
  numberWheel: {
    height: WHEEL_HEIGHT,
    width: NUMBER_WHEEL_WIDTH,
  },
  content: {
    paddingVertical: EDGE_PADDING,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  side: {
    flex: 1,
    paddingLeft: spacing.xs,
  },
  row: {
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  rowLabel: {
    color: colors.textSecondary,
    fontWeight: '400',
  },
  centeredLabel: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  unit: {
    color: colors.textPrimary,
  },
});
