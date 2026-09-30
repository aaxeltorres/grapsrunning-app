import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, motion, radius, spacing, typography } from '../theme';
import { bubbleCorners } from './ChatBubble';

const DOT_COUNT = 3;
const DOT_SIZE = spacing.xs;
const DOT_RISE = 3;
const DOT_STAGGER_MS = 160;
const DOT_STEP_MS = 300;
const DOT_REST_MS = 200;
const FADE_IN_MS = 150;
const ENTER_SCALE = 0.85;

type Props = {
  /** First item of Mike's group: rounds the top corner next to the avatar. */
  isFirstInGroup?: boolean;
  reduceMotion?: boolean;
};

/**
 * "Mike is typing" bubble with three animated dots, shaped like one of
 * Mike's chat bubbles.
 */
export default function TypingIndicator({
  isFirstInGroup = true,
  reduceMotion = false,
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const dots = useRef(
    Array.from({ length: DOT_COUNT }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    const fade = Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_IN_MS,
      easing: motion.easeStandard,
      useNativeDriver: true,
    });
    const animation = reduceMotion
      ? fade
      : Animated.parallel([
          fade,
          Animated.spring(enter, {
            toValue: 1,
            ...motion.springPop,
            useNativeDriver: true,
          }),
        ]);

    animation.start();
    return () => animation.stop();
    // Entrance runs once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Every loop has the same total length, so the wave stays in phase.
    const loops = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * DOT_STAGGER_MS),
          Animated.timing(dot, {
            toValue: 1,
            duration: DOT_STEP_MS,
            easing: motion.easeStandard,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: DOT_STEP_MS,
            easing: motion.easeStandard,
            useNativeDriver: true,
          }),
          Animated.delay(
            (DOT_COUNT - 1 - index) * DOT_STAGGER_MS + DOT_REST_MS,
          ),
        ]),
      ),
    );

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [dots]);

  return (
    <Animated.View
      accessible
      accessibilityLabel="Mike is typing"
      style={[
        styles.bubble,
        bubbleCorners('mike', isFirstInGroup, true),
        {
          opacity,
          transform: [
            {
              scale: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [ENTER_SCALE, 1],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.dots}>
        {dots.map((dot, index) => (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                opacity: dot.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.4, 1],
                }),
                // Reduce Motion: pulse the opacity only, no bouncing.
                transform: reduceMotion
                  ? []
                  : [
                      {
                        translateY: dot.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -DOT_RISE],
                        }),
                      },
                    ],
              },
            ]}
          />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    // Same height as a one-line ChatBubble, so the swap doesn't jump.
    minHeight: (typography.body.lineHeight ?? 0) + spacing.xs * 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.chatBubbleIncoming,
    transformOrigin: 'left bottom',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: colors.chatTypingDot,
  },
});
