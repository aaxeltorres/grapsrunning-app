import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import {
  amountForMainEnd,
  amountLimits,
  clampAmount,
  domainSeconds,
  layoutFor,
  type EditorContext,
  type EditorKind,
  type Layout,
} from '../coach/workoutEditor';
import { colors, radius, spacing, typography } from '../theme';
import { lightImpact, selectionTick } from '../utils/haptics';
import { formatMinutes } from './WorkoutCard';

const TRACK_HEIGHT = 48;
const SEGMENT_GAP = 2;
const HANDLE_WIDTH = 30;
const HANDLE_HEIGHT = 64;
const BUBBLE_WIDTH = 176;
const BUBBLE_HEIGHT = 34;
const BUBBLE_ZONE = BUBBLE_HEIGHT + spacing.sm;
// Dragging past a limit moves the handle this share of the finger...
const LIMIT_RESISTANCE = 0.3;
// ...by at most this many points.
const MAX_OVERSHOOT = 26;
const SEGMENT_SPRING = { stiffness: 420, damping: 34, mass: 1 } as const;
const OVERSHOOT_SPRING = { stiffness: 320, damping: 14, mass: 0.8 } as const;
const BUBBLE_HIDE_DELAY_MS = 450;
// Labels need room: wide segments get a name, narrow ones only minutes.
const NAMED_LABEL_PX = 70;
const MINUTES_LABEL_PX = 36;

// Web: the handle owns every drag that starts on it; the browser must not
// pan or navigate.
const WEB_NO_PAN = { touchAction: 'none' } as unknown as ViewStyle;

type Props = {
  kind: EditorKind;
  ctx: EditorContext;
  /** Minutes of the main block, or repetitions (see `Draft`). */
  amount: number;
  /** Color of the main block: the run type's color. */
  color: string;
  onAmountChange: (amount: number) => void;
  /** True while the handle is held, so a parent can lock its scrolling. */
  onDraggingChange?: (dragging: boolean) => void;
  reduceMotion?: boolean;
};

function minutesLabel(seconds: number) {
  const minutes = Math.round(seconds / 6) / 10;
  return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)} min`;
}

function segmentLabel(name: string, seconds: number, px: number) {
  // Some sessions have no warm-up or cool-down: no "0′" label.
  if (seconds <= 0) return '';
  if (px >= NAMED_LABEL_PX) return `${name}\n${minutesLabel(seconds)}`;
  if (px >= MINUTES_LABEL_PX) return minutesLabel(seconds);
  return `${Math.round(seconds / 60)}′`;
}

/**
 * The structure of a run as a bar: warm-up, main block and cool-down,
 * drawn to one fixed scale per run type. Drag the handle on the right
 * edge of the main block to stretch or shrink the run; it snaps step by
 * step with a haptic tick, a bubble above shows the live value, and the
 * limits give like a soft spring.
 */
export default function DurationBar({
  kind,
  ctx,
  amount,
  color,
  onAmountChange,
  onDraggingChange,
  reduceMotion = false,
}: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [dragging, setDragging] = useState(false);

  const layout = useMemo(() => layoutFor(kind, amount, ctx), [kind, amount, ctx]);
  const domain = useMemo(() => domainSeconds(kind, ctx), [kind, ctx]);
  const pxPerSecond = trackWidth > 0 ? trackWidth / domain : 0;

  const warmPx = useRef(new Animated.Value(0)).current;
  const mainPx = useRef(new Animated.Value(0)).current;
  const coolPx = useRef(new Animated.Value(0)).current;
  const overshoot = useRef(new Animated.Value(0)).current;
  const bubble = useRef(new Animated.Value(0)).current;
  const measuredRef = useRef(false);

  // Segments glide to their new size; the first measure sets them directly.
  useEffect(() => {
    if (trackWidth <= 0) return;
    const targets: [Animated.Value, number][] = [
      [warmPx, layout.warmSeconds * pxPerSecond],
      [mainPx, layout.mainSeconds * pxPerSecond],
      [coolPx, layout.coolSeconds * pxPerSecond],
    ];
    if (!measuredRef.current || reduceMotion) {
      measuredRef.current = true;
      targets.forEach(([value, target]) => value.setValue(target));
      return;
    }
    const animations = targets.map(([value, toValue]) =>
      Animated.spring(value, {
        toValue,
        ...SEGMENT_SPRING,
        useNativeDriver: false,
      }),
    );
    Animated.parallel(animations).start();
    return () => animations.forEach((animation) => animation.stop());
  }, [layout, pxPerSecond, trackWidth, reduceMotion, warmPx, mainPx, coolPx]);

  // Everything the drag handlers read, kept fresh without rebuilding them.
  const latest = useRef({
    kind,
    ctx,
    amount,
    layout,
    pxPerSecond,
    reduceMotion,
    onAmountChange,
    onDraggingChange,
  });
  latest.current = {
    kind,
    ctx,
    amount,
    layout,
    pxPerSecond,
    reduceMotion,
    onAmountChange,
    onDraggingChange,
  };
  const dragRef = useRef({
    active: false,
    baseX: 0,
    dx: 0,
    amount: 0,
    atLimit: false,
  });

  const mainEndPx = (forKind: EditorKind, forAmount: number) => {
    const { ctx: c, pxPerSecond: scale } = latest.current;
    const l = layoutFor(forKind, forAmount, c);
    return (l.warmSeconds + l.mainSeconds) * scale;
  };

  // The type changed while the handle is held (e.g. a keyboard or
  // assistive action): keep following the finger from the new position.
  useEffect(() => {
    const drag = dragRef.current;
    if (!drag.active) return;
    drag.baseX = (layout.warmSeconds + layout.mainSeconds) * pxPerSecond - drag.dx;
    drag.amount = amount;
    drag.atLimit = false;
    // Only a type change rebases the drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Nothing may steal the handle mid-drag, not even a scroll view.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          const { kind: k, amount: a, onDraggingChange: notify } = latest.current;
          overshoot.stopAnimation();
          dragRef.current = {
            active: true,
            baseX: mainEndPx(k, a),
            dx: 0,
            amount: a,
            atLimit: false,
          };
          setDragging(true);
          notify?.(true);
          Animated.spring(bubble, {
            toValue: 1,
            ...SEGMENT_SPRING,
            useNativeDriver: false,
          }).start();
        },
        onPanResponderMove: (_, g) => {
          const drag = dragRef.current;
          if (!drag.active) return;
          drag.dx = g.dx;
          const { kind: k, ctx: c, pxPerSecond: scale } = latest.current;
          if (scale <= 0) return;

          const x = drag.baseX + g.dx;
          const next = amountForMainEnd(k, x / scale, c);
          if (next !== drag.amount) {
            drag.amount = next;
            selectionTick();
            latest.current.onAmountChange(next);
          }

          // Past the shortest or longest run the handle gives a little.
          const limits = amountLimits(k, c);
          const minX = mainEndPx(k, limits.min);
          const maxX = mainEndPx(k, limits.max);
          const past = x > maxX ? x - maxX : x < minX ? x - minX : 0;
          const give = Math.max(
            -MAX_OVERSHOOT,
            Math.min(MAX_OVERSHOOT, past * LIMIT_RESISTANCE),
          );
          if (past !== 0 && !drag.atLimit) lightImpact();
          drag.atLimit = past !== 0;
          overshoot.setValue(give);
        },
        onPanResponderRelease: () => endDrag(),
        onPanResponderTerminate: () => endDrag(),
      }),
    // Handlers read the latest values from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function endDrag() {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    setDragging(false);
    latest.current.onDraggingChange?.(false);
    if (latest.current.reduceMotion) overshoot.setValue(0);
    else {
      Animated.spring(overshoot, {
        toValue: 0,
        ...OVERSHOOT_SPRING,
        useNativeDriver: false,
      }).start();
    }
    Animated.timing(bubble, {
      toValue: 0,
      delay: BUBBLE_HIDE_DELAY_MS,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    const { step } = amountLimits(kind, ctx);
    const delta = event.nativeEvent.actionName === 'increment' ? step : -step;
    const next = clampAmount(kind, amount + delta, ctx);
    if (next !== amount) {
      selectionTick();
      onAmountChange(next);
    }
  };

  const handleLayout = (event: LayoutChangeEvent) =>
    setTrackWidth(event.nativeEvent.layout.width);

  // Handle and bubble ride the end of the main block, plus the give.
  const handleCenter = Animated.add(Animated.add(warmPx, mainPx), overshoot);
  const handleLeft = Animated.subtract(handleCenter, HANDLE_WIDTH / 2);
  const bubbleRange =
    trackWidth > BUBBLE_WIDTH
      ? [BUBBLE_WIDTH / 2, trackWidth - BUBBLE_WIDTH / 2]
      : [0, 1];
  const bubbleLeft = handleCenter.interpolate({
    inputRange: bubbleRange,
    outputRange: [0, Math.max(0, trackWidth - BUBBLE_WIDTH)],
    extrapolate: 'clamp',
  });
  // The tail keeps pointing at the handle when the bubble is held inside
  // the track near either end.
  const tailX = Animated.subtract(
    handleCenter,
    Animated.add(bubbleLeft, BUBBLE_WIDTH / 2),
  );

  const isReps = layout.reps !== undefined;
  const bubbleText = isReps
    ? `${layout.reps} reps · ${formatMinutes(layout.totalSeconds)}`
    : formatMinutes(layout.mainSeconds);
  const valueText = isReps
    ? `${layout.reps} repetitions, ${formatMinutes(layout.totalSeconds)} in total`
    : `${formatMinutes(layout.totalSeconds)} in total`;
  const mainName = isReps
    ? kind === 'intervals'
      ? `${layout.reps} reps`
      : `${layout.reps} × run/walk`
    : 'Main';

  return (
    <View style={styles.root}>
      <View style={styles.bubbleZone} pointerEvents="none">
        <Animated.View
          style={[
            styles.bubbleWrap,
            {
              opacity: bubble,
              transform: [
                { translateX: bubbleLeft },
                { scale: bubble.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
              ],
            },
          ]}
        >
          <View style={[styles.bubble, { backgroundColor: color }]}>
            <Text numberOfLines={1} style={[typography.headline, styles.bubbleText]}>
              {bubbleText}
            </Text>
          </View>
          <Animated.View
            style={[
              styles.bubbleTail,
              { backgroundColor: color, transform: [{ translateX: tailX }, { rotate: '45deg' }] },
            ]}
          />
        </Animated.View>
      </View>

      <View style={styles.trackArea} onLayout={handleLayout}>
        <View style={styles.rail} />
        <View style={styles.segments}>
          <Animated.View
            style={[styles.segment, styles.muted, { width: warmPx }]}
          />
          <Animated.View style={[styles.segment, { width: mainPx }]}>
            <MainBlock layout={layout} color={color} />
          </Animated.View>
          <Animated.View
            style={[styles.segment, styles.muted, { width: coolPx }]}
          />
        </View>

        <Animated.View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Run length"
          accessibilityValue={{ text: valueText }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={handleAccessibilityAction}
          hitSlop={{ top: 12, bottom: 12, left: 14, right: 14 }}
          style={[
            styles.handle,
            dragging && styles.handleActive,
            WEB_NO_PAN,
            { transform: [{ translateX: handleLeft }] },
          ]}
          {...panResponder.panHandlers}
        >
          <View style={styles.grip} />
          <View style={styles.grip} />
        </Animated.View>
      </View>

      <View style={styles.labels}>
        <Animated.View style={[styles.labelBox, { width: warmPx }]}>
          <Text style={[typography.caption, styles.label]}>
            {segmentLabel('Warm-up', layout.warmSeconds, layout.warmSeconds * pxPerSecond)}
          </Text>
        </Animated.View>
        <Animated.View style={[styles.labelBox, { width: mainPx }]}>
          <Text style={[typography.caption, styles.label, styles.mainLabel]}>
            {segmentLabel(mainName, layout.mainSeconds, layout.mainSeconds * pxPerSecond)}
          </Text>
        </Animated.View>
        <Animated.View style={[styles.labelBox, { width: coolPx }]}>
          <Text style={[typography.caption, styles.label]}>
            {segmentLabel('Cool-down', layout.coolSeconds, layout.coolSeconds * pxPerSecond)}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

/** The main block: one fill, or the repeated work and recovery blocks. */
function MainBlock({ layout, color }: { layout: Layout; color: string }) {
  if (layout.reps === undefined) {
    return <View style={[styles.fill, { backgroundColor: color }]} />;
  }
  return (
    <View style={styles.repRow}>
      {Array.from({ length: layout.reps }, (_, index) => (
        <React.Fragment key={index}>
          <View
            style={[
              styles.fill,
              { flex: layout.workSeconds, backgroundColor: color },
            ]}
          />
          <View
            style={[
              styles.fill,
              styles.recovery,
              { flex: layout.recoverySeconds },
            ]}
          />
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingTop: spacing.xxs,
    // Room for the give at the limits and the labels; nothing spills out.
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    overflow: 'hidden',
    // Dragging the handle must not select the labels it passes over.
    userSelect: 'none',
  },
  bubbleZone: {
    height: BUBBLE_ZONE,
  },
  bubbleWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: BUBBLE_WIDTH,
    alignItems: 'center',
  },
  bubble: {
    height: BUBBLE_HEIGHT,
    minWidth: 72,
    maxWidth: BUBBLE_WIDTH,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleText: {
    color: colors.white,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -4,
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  trackArea: {
    height: HANDLE_HEIGHT,
    justifyContent: 'center',
  },
  rail: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: TRACK_HEIGHT,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceGray,
  },
  segments: {
    flexDirection: 'row',
    height: TRACK_HEIGHT,
    gap: SEGMENT_GAP,
  },
  segment: {
    height: TRACK_HEIGHT,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  muted: {
    backgroundColor: colors.planSegmentMuted,
  },
  fill: {
    flex: 1,
  },
  repRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 1,
  },
  recovery: {
    backgroundColor: colors.planSegmentMuted,
  },
  handle: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: HANDLE_WIDTH,
    height: HANDLE_HEIGHT,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  handleActive: {
    shadowOpacity: 0.28,
    shadowRadius: 10,
  },
  grip: {
    width: 3,
    height: 22,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
  },
  labels: {
    flexDirection: 'row',
    gap: SEGMENT_GAP,
    marginTop: spacing.xxs,
    minHeight: 32,
  },
  labelBox: {
    alignItems: 'center',
  },
  label: {
    width: 84,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  mainLabel: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
