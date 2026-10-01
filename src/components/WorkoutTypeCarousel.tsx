import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import { SESSION_NAMES, type SessionId } from '../coach/plan';
import { workoutType, type EditorKind } from '../coach/workoutEditor';
import { colors, radius, spacing, typography } from '../theme';
import { selectionTick } from '../utils/haptics';
import { WORKOUT_TYPE_COLORS } from './WorkoutCard';

const CARD_WIDTH = 112;
const CARD_HEIGHT = 100;
const CARD_GAP = spacing.sm;
const STEP = CARD_WIDTH + CARD_GAP;
const SIDE_SCALE = 0.86;
// Dragging past the first or last card moves it this share of the finger.
const EDGE_RESISTANCE = 0.35;
// How far a flick carries the deck: milliseconds of release velocity.
const FLICK_MS = 160;
const DRAG_START_PX = 6;
const SPRING = { stiffness: 300, damping: 26, mass: 1 } as const;
const WHITE_SOFT = 'rgba(255,255,255,0.85)';

// Web: sideways drags belong to the deck, not to the browser (which would
// treat them as a swipe back); vertical drags still scroll the sheet.
const WEB_PAN_Y = { touchAction: 'pan-y' } as unknown as ViewStyle;

type CardInfo = { emoji: string; label: string; hint: string };

const CARDS: Record<EditorKind, CardInfo> = {
  easy: { emoji: '🌿', label: 'Easy', hint: 'Chatty pace' },
  runWalk: { emoji: '🚶', label: 'Run/walk', hint: 'Mix it up' },
  long: { emoji: '🛣️', label: 'Long run', hint: 'Go the distance' },
  intervals: { emoji: '⚡️', label: 'Intervals', hint: 'Fast reps' },
  ...sessionCards({
    regenerative: ['💙', 'Recovery jog'],
    extensiveAerobic: ['🫁', 'Steady Z3'],
    progressive: ['📈', 'Build the zones'],
    tempoRun: ['⏱️', 'Z3 then Z4'],
    strides: ['🌬️', 'Short and quick'],
    fartlek: ['🎈', 'Speed play'],
    mixedIntervals: ['🔁', '2-min efforts'],
    longIntervals: ['🧗', '3-min efforts'],
    hiit: ['🔥', 'Short bursts'],
    hiitMacro: ['💥', 'Bursts in sets'],
    sprints: ['🏃', 'Full rests'],
  }),
};

/** Session cards use the session's own name, as on the workout card. */
function sessionCards(
  cards: Record<SessionId, [emoji: string, hint: string]>,
): Record<SessionId, CardInfo> {
  const out = {} as Record<SessionId, CardInfo>;
  for (const id of Object.keys(cards) as SessionId[]) {
    const [emoji, hint] = cards[id];
    out[id] = { emoji, label: SESSION_NAMES[id], hint };
  }
  return out;
}

/** The card takes its category's color; run/walk is an easy day. */
function colorFor(kind: EditorKind) {
  const type = workoutType(kind);
  return WORKOUT_TYPE_COLORS[type === 'rest' ? 'easy' : type];
}

type Props = {
  kinds: EditorKind[];
  selected: EditorKind;
  onSelect: (kind: EditorKind) => void;
  reduceMotion?: boolean;
};

/**
 * Swipeable deck of run types. The centered card is the selected one: it
 * grows, takes the type's color and snaps into place with a light haptic
 * tick. Built on PanResponder so a finger and a mouse behave the same.
 */
export default function WorkoutTypeCarousel({
  kinds,
  selected,
  onSelect,
  reduceMotion = false,
}: Props) {
  const [width, setWidth] = useState(0);
  const lastIndex = kinds.length - 1;
  const selectedIndex = Math.max(0, kinds.indexOf(selected));

  // Position of the deck in card units: 0 shows the first card centered,
  // fractions appear while dragging.
  const pos = useRef(new Animated.Value(selectedIndex)).current;
  const posRef = useRef(selectedIndex);
  const indexRef = useRef(selectedIndex);
  const startPosRef = useRef(selectedIndex);
  const tickIndexRef = useRef(selectedIndex);
  const draggingRef = useRef(false);
  // Set once a gesture is clearly a sideways swipe (otherwise it is a tap).
  const swipingRef = useRef(false);
  const startIndexRef = useRef(selectedIndex);
  const touchXRef = useRef(0);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const widthRef = useRef(0);

  useEffect(() => {
    const id = pos.addListener(({ value }) => {
      posRef.current = value;
    });
    return () => pos.removeListener(id);
  }, [pos]);

  const latest = useRef({ kinds, onSelect, reduceMotion, lastIndex });
  latest.current = { kinds, onSelect, reduceMotion, lastIndex };

  const settleAt = (index: number) => {
    pos.stopAnimation();
    if (latest.current.reduceMotion) {
      pos.setValue(index);
      return;
    }
    Animated.spring(pos, {
      toValue: index,
      ...SPRING,
      useNativeDriver: false,
    }).start();
  };

  const commit = (index: number) => {
    const { kinds: current, onSelect: select } = latest.current;
    if (index !== tickIndexRef.current) selectionTick();
    tickIndexRef.current = index;
    settleAt(index);
    if (index !== indexRef.current) {
      indexRef.current = index;
      select(current[index]);
    }
  };

  // The selection changed from outside (e.g. a new editor session).
  useEffect(() => {
    if (draggingRef.current || selectedIndex === indexRef.current) return;
    indexRef.current = selectedIndex;
    tickIndexRef.current = selectedIndex;
    settleAt(selectedIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  const clampIndex = (value: number) =>
    Math.min(latest.current.lastIndex, Math.max(0, value));

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // The sheet's scroll view may take the touch only when the finger
        // is clearly going up or down.
        onPanResponderTerminationRequest: (event) => {
          const { pageX, pageY } = event.nativeEvent;
          const dx = Math.abs(pageX - touchStartRef.current.x);
          const dy = Math.abs(pageY - touchStartRef.current.y);
          return dy > DRAG_START_PX && dy > dx;
        },
        onPanResponderGrant: (event) => {
          pos.stopAnimation();
          draggingRef.current = true;
          swipingRef.current = false;
          startPosRef.current = posRef.current;
          startIndexRef.current = clampIndex(Math.round(posRef.current));
          touchXRef.current = event.nativeEvent.locationX;
          touchStartRef.current = {
            x: event.nativeEvent.pageX,
            y: event.nativeEvent.pageY,
          };
        },
        onPanResponderMove: (_, g) => {
          if (
            !swipingRef.current &&
            Math.abs(g.dx) > DRAG_START_PX &&
            Math.abs(g.dx) > Math.abs(g.dy)
          ) {
            swipingRef.current = true;
          }
          if (!swipingRef.current) return;

          const raw = startPosRef.current - g.dx / STEP;
          const edge = latest.current.lastIndex;
          // Past either end the deck resists, like a rubber band.
          const shown =
            raw < 0
              ? raw * EDGE_RESISTANCE
              : raw > edge
                ? edge + (raw - edge) * EDGE_RESISTANCE
                : raw;
          pos.setValue(shown);
          const nearest = clampIndex(Math.round(raw));
          if (nearest !== tickIndexRef.current) {
            tickIndexRef.current = nearest;
            selectionTick();
          }
        },
        onPanResponderRelease: (_, g) => {
          draggingRef.current = false;
          const start = startIndexRef.current;
          if (!swipingRef.current) {
            // A tap: the card under the finger, measured from the center.
            const offset = (touchXRef.current - widthRef.current / 2) / STEP;
            commit(clampIndex(Math.round(posRef.current + offset)));
            return;
          }
          swipingRef.current = false;
          const raw = startPosRef.current - g.dx / STEP;
          // A flick carries on a little further in its direction...
          const projected = raw - (g.vx * FLICK_MS) / STEP;
          // ...but never more than one card from where the swipe began.
          commit(
            Math.min(start + 1, Math.max(start - 1, clampIndex(Math.round(projected)))),
          );
        },
        onPanResponderTerminate: () => {
          draggingRef.current = false;
          swipingRef.current = false;
          commit(clampIndex(Math.round(posRef.current)));
        },
      }),
    // `pos` and the refs are stable; everything else is read from `latest`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pos],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    widthRef.current = event.nativeEvent.layout.width;
    setWidth(event.nativeEvent.layout.width);
  };

  const trackStyle = {
    marginLeft: (width - CARD_WIDTH) / 2,
    transform: [
      {
        translateX: pos.interpolate({
          inputRange: [0, Math.max(1, lastIndex)],
          outputRange: [0, -Math.max(1, lastIndex) * STEP],
        }),
      },
    ],
  };

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Run type"
      onLayout={handleLayout}
      style={[styles.viewport, WEB_PAN_Y]}
      {...panResponder.panHandlers}
    >
      {/* Cards ignore touches: the deck itself reads taps and swipes, so a
          card can never keep a gesture away from the swipe. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.track, trackStyle]}
      >
        {kinds.map((kind, index) => (
          <Card
            key={kind}
            kind={kind}
            index={index}
            pos={pos}
            selected={kind === selected}
            onActivate={() => commit(index)}
          />
        ))}
      </Animated.View>
    </View>
  );
}

type CardProps = {
  kind: EditorKind;
  index: number;
  pos: Animated.Value;
  selected: boolean;
  /** Screen readers: double tap selects the card. */
  onActivate: () => void;
};

const Card = React.memo(function Card({
  kind,
  index,
  pos,
  selected,
  onActivate,
}: CardProps) {
  const info = CARDS[kind];
  const color = colorFor(kind);
  const range = [index - 1, index, index + 1];
  const mix = <T extends string | number>(side: T, center: T) => ({
    inputRange: range,
    outputRange: [side, center, side],
    extrapolate: 'clamp' as const,
  });

  return (
    <Animated.View
      accessible
      accessibilityRole="radio"
      accessibilityLabel={info.label}
      accessibilityState={{ checked: selected }}
      onAccessibilityTap={onActivate}
      style={[
        styles.card,
        {
          backgroundColor: pos.interpolate(mix(colors.surfaceGray, color)),
          transform: [{ scale: pos.interpolate(mix(SIDE_SCALE, 1)) }],
          opacity: pos.interpolate(mix(0.7, 1)),
        },
      ]}
    >
      <Text style={styles.emoji}>{info.emoji}</Text>
      <Animated.Text
        numberOfLines={1}
        // Session names such as "Extensive aerobic" shrink to fit the card.
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={[
          typography.headline,
          { color: pos.interpolate(mix(colors.textPrimary, colors.white)) },
        ]}
      >
        {info.label}
      </Animated.Text>
      <Animated.Text
        numberOfLines={1}
        style={[
          typography.caption,
          { color: pos.interpolate(mix(colors.textSecondary, WHITE_SOFT)) },
        ]}
      >
        {info.hint}
      </Animated.Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  viewport: {
    // Grows with the selected card, so its shadow is never clipped.
    paddingVertical: spacing.xxs,
    overflow: 'hidden',
    // A mouse drag must swipe the deck, not select the text under it.
    userSelect: 'none',
  },
  track: {
    flexDirection: 'row',
    gap: CARD_GAP,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: spacing.xs,
  },
  emoji: {
    fontSize: 28,
    lineHeight: 34,
  },
});
