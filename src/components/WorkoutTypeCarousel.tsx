import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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
// Without a momentum phase (a slow release), commit after this pause.
const SETTLE_FALLBACK_MS = 120;
const WHITE_SOFT = 'rgba(255,255,255,0.85)';

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

type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;

/**
 * Run types on a native horizontal scroll: a flick travels across many
 * types with momentum and the tiles snap so one sits in the center. The
 * centered tile takes its type's color as it passes (driven on the native
 * thread), with a light haptic tick; the selection is committed when the
 * scroll settles, or right away when a tile is tapped (it scrolls to the
 * center).
 */
function WorkoutTypeCarousel({
  kinds,
  selected,
  onSelect,
  reduceMotion = false,
}: Props) {
  const [width, setWidth] = useState(0);
  const selectedIndex = Math.max(0, kinds.indexOf(selected));

  const scrollRef = useRef<ScrollView>(null);
  // Scroll offset, on the native thread: every tile's look derives from it.
  const scrollX = useRef(new Animated.Value(selectedIndex * STEP)).current;
  const indexRef = useRef(selectedIndex);
  const tickIndexRef = useRef(selectedIndex);
  const momentumRef = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const latest = useRef({ kinds, onSelect, reduceMotion });
  latest.current = { kinds, onSelect, reduceMotion };

  const indexAt = useCallback(
    (x: number) =>
      Math.min(
        latest.current.kinds.length - 1,
        Math.max(0, Math.round(x / STEP)),
      ),
    [],
  );

  const commit = useCallback((index: number) => {
    const { kinds: current, onSelect: select } = latest.current;
    if (index !== tickIndexRef.current) selectionTick();
    tickIndexRef.current = index;
    if (index !== indexRef.current) {
      indexRef.current = index;
      select(current[index]);
    }
  }, []);

  const clearSettle = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = null;
  }, []);
  useEffect(() => clearSettle, [clearSettle]);

  // The offset is native-driven; the JS listener only ticks when the
  // centered tile changes.
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: true,
        listener: (event: ScrollEvent) => {
          const index = indexAt(event.nativeEvent.contentOffset.x);
          if (index !== tickIndexRef.current) {
            tickIndexRef.current = index;
            selectionTick();
          }
        },
      }),
    [scrollX, indexAt],
  );

  const handleScrollBeginDrag = () => {
    momentumRef.current = false;
    clearSettle();
  };

  const handleScrollEndDrag = (event: ScrollEvent) => {
    const x = event.nativeEvent.contentOffset.x;
    clearSettle();
    // A flick goes on with momentum; a slow release may not.
    settleTimer.current = setTimeout(() => {
      if (!momentumRef.current) commit(indexAt(x));
    }, SETTLE_FALLBACK_MS);
  };

  const handleMomentumBegin = () => {
    momentumRef.current = true;
    clearSettle();
  };

  const handleMomentumEnd = (event: ScrollEvent) => {
    momentumRef.current = false;
    commit(indexAt(event.nativeEvent.contentOffset.x));
  };

  const scrollToIndex = useCallback((index: number) => {
    scrollRef.current?.scrollTo({
      x: index * STEP,
      animated: !latest.current.reduceMotion,
    });
  }, []);

  // A tap brings the tile to the center and selects it.
  const handlePress = useCallback(
    (index: number) => {
      scrollToIndex(index);
      commit(index);
    },
    [scrollToIndex, commit],
  );

  // The selection changed from outside (e.g. a new editor session).
  useEffect(() => {
    if (selectedIndex === indexRef.current) return;
    indexRef.current = selectedIndex;
    tickIndexRef.current = selectedIndex;
    scrollToIndex(selectedIndex);
  }, [selectedIndex, scrollToIndex]);

  const handleLayout = (event: LayoutChangeEvent) =>
    setWidth(event.nativeEvent.layout.width);

  // Side room so the first and last tiles can reach the center.
  const side = Math.max(0, (width - CARD_WIDTH) / 2);

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Run type"
      onLayout={handleLayout}
      style={styles.viewport}
    >
      {width > 0 && (
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          // Opens on the current type.
          contentOffset={{ x: indexRef.current * STEP, y: 0 }}
          contentContainerStyle={[styles.track, { paddingHorizontal: side }]}
          snapToInterval={STEP}
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScroll={onScroll}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScrollEndDrag={handleScrollEndDrag}
          onMomentumScrollBegin={handleMomentumBegin}
          onMomentumScrollEnd={handleMomentumEnd}
        >
          {kinds.map((kind, index) => (
            <Card
              key={kind}
              kind={kind}
              index={index}
              scrollX={scrollX}
              selected={kind === selected}
              onPress={handlePress}
            />
          ))}
        </Animated.ScrollView>
      )}
    </View>
  );
}

export default React.memo(WorkoutTypeCarousel);

type CardProps = {
  kind: EditorKind;
  index: number;
  scrollX: Animated.Value;
  selected: boolean;
  onPress: (index: number) => void;
};

/**
 * A tile: a gray face with dark text and, on top, the type's colored face
 * with white text, faded in as the tile nears the center. Only opacity
 * and scale change, so the native driver runs it.
 */
const Card = React.memo(function Card({
  kind,
  index,
  scrollX,
  selected,
  onPress,
}: CardProps) {
  const info = CARDS[kind];
  const color = colorFor(kind);
  const { scale, opacity, colored } = useMemo(() => {
    const inputRange = [(index - 1) * STEP, index * STEP, (index + 1) * STEP];
    const mix = (side: number, center: number) =>
      scrollX.interpolate({
        inputRange,
        outputRange: [side, center, side],
        extrapolate: 'clamp',
      });
    return {
      scale: mix(SIDE_SCALE, 1),
      opacity: mix(0.7, 1),
      colored: mix(0, 1),
    };
  }, [scrollX, index]);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={info.label}
      accessibilityState={{ checked: selected }}
      onPress={() => onPress(index)}
    >
      <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
        <Face info={info} />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.card,
            styles.coloredFace,
            { backgroundColor: color, opacity: colored },
          ]}
        >
          <Face info={info} onColor />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
});

function Face({ info, onColor = false }: { info: CardInfo; onColor?: boolean }) {
  return (
    <>
      <Text style={styles.emoji}>{info.emoji}</Text>
      <Text
        numberOfLines={1}
        // Session names such as "Extensive aerobic" shrink to fit the card.
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={[
          typography.headline,
          { color: onColor ? colors.white : colors.textPrimary },
        ]}
      >
        {info.label}
      </Text>
      <Text
        numberOfLines={1}
        style={[
          typography.caption,
          { color: onColor ? WHITE_SOFT : colors.textSecondary },
        ]}
      >
        {info.hint}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  viewport: {
    // Tiles slide out to the screen edges, past the sheet's side padding.
    marginHorizontal: -spacing.lg,
    // A mouse drag must scroll the tiles, not select the text under them.
    userSelect: 'none',
  },
  track: {
    flexDirection: 'row',
    gap: CARD_GAP,
    // Room around the centered tile, so nothing is clipped.
    paddingVertical: spacing.xxs,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.surfaceGray,
  },
  coloredFace: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  emoji: {
    fontSize: 28,
    lineHeight: 34,
  },
});
