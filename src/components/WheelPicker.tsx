import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors, radius, spacing, typography } from '../theme';
import { selectionTick } from '../utils/haptics';
import {
  ROW_HEIGHT,
  canTick,
  isOffRow,
  isSlowRelease,
  nearestRow,
  rowOffset,
} from '../utils/wheel';

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
const IS_WEB = Platform.OS === 'web';
const IS_IOS = Platform.OS === 'ios';
// Fallback for a wheel that stops without telling us (a touch stopped the
// momentum off a row; web has no snap and no momentum events): with no
// scroll event for this long it settles on the nearest row. Native waits
// longer so the tail of a momentum is never cut.
const STALL_MS = IS_WEB ? 120 : 250;
// Longest a tap's scroll animation may take before the wheel is put on the
// tapped row and scroll events count as user input again.
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

/**
 * Who is moving the wheel right now.
 * - idle: at rest.
 * - dragging: a finger is on it.
 * - coasting: released with momentum, until it stops.
 * - programmatic: a tap (or a settle) is animating it to one exact row.
 */
type Mode = 'idle' | 'dragging' | 'coasting' | 'programmatic';

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
 * the wheel itself just reported. React never re-sends the scroll offset
 * either (it is a stable prop), so nothing else moves the wheel while a
 * finger, its momentum or a tap's animation is in charge.
 *
 * A tap selects exactly the pressed row and runs one animated scroll to it;
 * the rows that scroll passes are not reported. A slow release settles on
 * the row nearest to the finger (the native snap rounds by direction), a
 * flick keeps its momentum, and the value is read from the offset where
 * the wheel really stopped.
 */
export default function WheelPicker<T extends string | number>({
  items,
  selectedValue,
  onValueChange,
  unitLabel,
  accessibilityLabel,
}: Props<T>) {
  const scrollRef = useRef<ScrollView>(null);
  const reduceMotion = useReduceMotion();
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;

  const lastIndex = Math.max(0, items.length - 1);
  const lastIndexRef = useRef(lastIndex);
  lastIndexRef.current = lastIndex;
  const indexOf = useCallback(
    (value: T) => Math.max(0, items.findIndex((item) => item.value === value)),
    [items],
  );

  // Centered row. A ref updates synchronously during scrolling; the state
  // copy only restyles the centered label. The first row and offset are
  // frozen: `contentOffset` is a prop, and iOS applies a changed one
  // straight to the scroll view, which would yank the wheel to the row it
  // just reported in the middle of a drag, a flick or a tap's animation.
  const [initialIndex] = useState(() => indexOf(selectedValue));
  const [initialOffset] = useState(() => ({
    x: 0,
    y: rowOffset(initialIndex),
  }));
  const indexRef = useRef(initialIndex);
  const [centerIndex, setCenterIndex] = useState(initialIndex);
  const scrollY = useRef(new Animated.Value(rowOffset(initialIndex))).current;

  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const modeRef = useRef<Mode>('idle');
  // Row a tap is scrolling to (mode `programmatic`).
  const targetRef = useRef<number | null>(null);
  // Last scroll offset reported by the scroll view.
  const offsetRef = useRef(initialOffset.y);
  const lastTickRef = useRef(0);
  const laidOutRef = useRef(false);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(
    () => () => {
      clearTimeout(safetyTimerRef.current);
      clearTimeout(stallTimerRef.current);
    },
    [],
  );

  // Selects a row: restyles it, ticks and reports it. Same row, no-op.
  const commit = useCallback((index: number) => {
    if (index === indexRef.current) return;
    indexRef.current = index;
    setCenterIndex(index);
    const now = Date.now();
    if (canTick(now, lastTickRef.current)) {
      lastTickRef.current = now;
      selectionTick();
    }
    const item = itemsRef.current[index];
    if (item) onValueChangeRef.current(item.value);
  }, []);

  // A tap's animation should be over by now: land exactly on the tapped row.
  const forceToTarget = useCallback(() => {
    const target = targetRef.current;
    modeRef.current = 'idle';
    targetRef.current = null;
    if (target === null) return;
    scrollRef.current?.scrollTo({ y: rowOffset(target), animated: false });
  }, []);

  // Moves the wheel to a row on its own. Animated: one scroll that ends on
  // `onMomentumScrollEnd`, during which scroll events report nothing.
  const scrollToRow = useCallback(
    (index: number, animated: boolean) => {
      clearTimeout(safetyTimerRef.current);
      clearTimeout(stallTimerRef.current);
      if (animated) {
        modeRef.current = 'programmatic';
        targetRef.current = index;
        safetyTimerRef.current = setTimeout(
          forceToTarget,
          PROGRAMMATIC_SCROLL_MS,
        );
      } else {
        modeRef.current = 'idle';
        targetRef.current = null;
      }
      scrollRef.current?.scrollTo({ y: rowOffset(index), animated });
    },
    [forceToTarget],
  );

  // The wheel has stopped at `offset`: the row under the band is the value,
  // and a wheel that stopped between rows eases onto it.
  const settleAt = useCallback(
    (offset: number) => {
      clearTimeout(safetyTimerRef.current);
      clearTimeout(stallTimerRef.current);
      modeRef.current = 'idle';
      targetRef.current = null;
      const index = nearestRow(offset, lastIndexRef.current);
      commit(index);
      if (isOffRow(offset, lastIndexRef.current)) {
        scrollToRow(index, !reduceMotionRef.current);
      }
    },
    [commit, scrollToRow],
  );

  const armStallTimer = useCallback(() => {
    clearTimeout(stallTimerRef.current);
    stallTimerRef.current = setTimeout(
      () => settleAt(offsetRef.current),
      STALL_MS,
    );
  }, [settleAt]);

  // Outside changes only (e.g. a different question): our own reports
  // come back equal to `indexRef` and are ignored, so the wheel is never
  // pulled back to an older value while the user scrolls.
  useEffect(() => {
    const index = indexOf(selectedValue);
    if (index === indexRef.current) return;
    indexRef.current = index;
    setCenterIndex(index);
    scrollToRow(index, false);
  }, [selectedValue, indexOf, scrollToRow]);

  // Initial position. `contentOffset` covers iOS; web needs a scrollTo.
  const handleLayout = useCallback(() => {
    if (laidOutRef.current) return;
    laidOutRef.current = true;
    scrollRef.current?.scrollTo({
      y: rowOffset(indexRef.current),
      animated: false,
    });
  }, []);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      offsetRef.current = y;
      const mode = modeRef.current;
      // The rows a tap's animation passes are not selections.
      if (mode === 'programmatic') return;
      commit(nearestRow(y, lastIndexRef.current));
      // A finger still down is not a stop (web has no drag events).
      if (mode === 'dragging' && !IS_WEB) return;
      armStallTimer();
    },
    [commit, armStallTimer],
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
    clearTimeout(safetyTimerRef.current);
    clearTimeout(stallTimerRef.current);
    modeRef.current = 'dragging';
    targetRef.current = null;
  }, []);

  const handleDragEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, velocity } = event.nativeEvent;
      offsetRef.current = contentOffset.y;
      // The native snap rounds by direction (down: up a row, up: down a
      // row), so a slow release would go a row too far. Settle on the
      // nearest row instead; a flick keeps its momentum.
      if (IS_IOS && velocity && isSlowRelease(velocity.y)) {
        settleAt(contentOffset.y);
        return;
      }
      modeRef.current = 'coasting';
      armStallTimer();
    },
    [settleAt, armStallTimer],
  );

  // Momentum ended, or a tap's animation arrived.
  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      offsetRef.current = y;
      // A finger is back on the wheel: its release will settle it.
      if (modeRef.current === 'dragging') return;
      const target = targetRef.current;
      if (modeRef.current === 'programmatic' && target !== null) {
        // The end of an older scroll (a replaced animation): wait for ours.
        if (isOffRow(y, lastIndexRef.current)) return;
        if (nearestRow(y, lastIndexRef.current) !== target) return;
        clearTimeout(safetyTimerRef.current);
        modeRef.current = 'idle';
        targetRef.current = null;
        return;
      }
      settleAt(y);
    },
    [settleAt],
  );

  const handleRowPress = useCallback(
    (index: number) => {
      commit(index);
      scrollToRow(index, !reduceMotionRef.current);
    },
    [commit, scrollToRow],
  );

  const handleAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const delta = event.nativeEvent.actionName === 'increment' ? 1 : -1;
      const index = clamp(indexRef.current + delta, 0, lastIndexRef.current);
      commit(index);
      scrollToRow(index, false);
    },
    [commit, scrollToRow],
  );

  const isNumber = unitLabel !== undefined;
  const centerLabel = items[centerIndex]?.label ?? '';

  const wheel = (
    <Animated.ScrollView
      ref={scrollRef}
      style={isNumber ? styles.numberWheel : styles.fullWheel}
      contentContainerStyle={styles.content}
      contentOffset={initialOffset}
      snapToInterval={ROW_HEIGHT}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={SCROLL_THROTTLE_MS}
      nestedScrollEnabled
      onScroll={onScroll}
      onScrollBeginDrag={handleDragStart}
      onScrollEndDrag={handleDragEnd}
      onMomentumScrollEnd={handleMomentumEnd}
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
          reduceMotion={reduceMotion}
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
  reduceMotion: boolean;
  onPress: (index: number) => void;
};

const WheelRow = React.memo(function WheelRow({
  label,
  index,
  scrollY,
  centered,
  isNumber,
  reduceMotion,
  onPress,
}: RowProps) {
  // Built once per row: new interpolations on every render would re-attach
  // the row's native animation each time it is restyled.
  const { opacity, scale } = useMemo(() => {
    const center = rowOffset(index);
    const inputRange = [
      center - ROW_HEIGHT * 2,
      center - ROW_HEIGHT,
      center,
      center + ROW_HEIGHT,
      center + ROW_HEIGHT * 2,
    ];
    return {
      opacity: scrollY.interpolate({
        inputRange,
        outputRange: [
          ROW_OPACITY[2],
          ROW_OPACITY[1],
          ROW_OPACITY[0],
          ROW_OPACITY[1],
          ROW_OPACITY[2],
        ],
        extrapolate: 'clamp',
      }),
      scale: scrollY.interpolate({
        inputRange,
        outputRange: [
          ROW_SCALE[2],
          ROW_SCALE[1],
          ROW_SCALE[0],
          ROW_SCALE[1],
          ROW_SCALE[2],
        ],
        extrapolate: 'clamp',
      }),
    };
  }, [index, scrollY]);

  const handlePress = useCallback(() => onPress(index), [onPress, index]);

  return (
    <Pressable
      onPress={handlePress}
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
          // Reduce Motion keeps the fade and drops the zoom.
          reduceMotion ? { opacity } : { opacity, transform: [{ scale }] },
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
