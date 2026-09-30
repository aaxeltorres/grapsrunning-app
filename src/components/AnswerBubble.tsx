import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';
import { colors, motion, radius, spacing, typography } from '../theme';

const PENDING_TEXT = 'Tap to answer';
const PULSE_MS = 900;
const PULSE_MIN_OPACITY = 0.5;
const POP_FROM_SCALE = 0.9;

type Props = {
  /** The answer, or `null` while waiting for one. */
  text: string | null;
  /** Short description of the question, for screen readers. */
  questionLabel: string;
  onPress: () => void;
  animateOnMount?: boolean;
  reduceMotion?: boolean;
};

/**
 * The user's answer bubble, on the right. While pending it shows a dashed
 * outline with "Tap to answer" and a subtle pulse; once answered it fills
 * in with a small pop. Tapping it opens the answer sheet (to answer or
 * edit).
 */
function AnswerBubble({
  text,
  questionLabel,
  onPress,
  animateOnMount = true,
  reduceMotion = false,
}: Props) {
  const isPending = text === null;
  const entrance = useEntranceAnimation({
    animate: animateOnMount,
    reduceMotion,
    offsetY: 10,
    fromScale: 0.92,
  });
  const pulse = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const previousText = useRef(text);

  useEffect(() => {
    if (!isPending || reduceMotion) {
      pulse.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: PULSE_MIN_OPACITY,
          duration: PULSE_MS,
          easing: motion.easeStandard,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: PULSE_MS,
          easing: motion.easeStandard,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isPending, reduceMotion, pulse]);

  // Pop whenever the answer is filled in or changed.
  useEffect(() => {
    if (previousText.current === text) return;
    previousText.current = text;
    if (text === null || reduceMotion) return;

    pop.setValue(POP_FROM_SCALE);
    const spring = Animated.spring(pop, {
      toValue: 1,
      ...motion.springBounce,
      useNativeDriver: true,
    });
    spring.start();
    return () => spring.stop();
  }, [text, reduceMotion, pop]);

  return (
    <Animated.View style={[styles.container, entrance]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          isPending
            ? `${questionLabel}. Not answered yet.`
            : `${questionLabel}: ${text}`
        }
        accessibilityHint={
          isPending ? 'Opens the answer picker' : 'Change your answer'
        }
        onPress={onPress}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Animated.View
          style={[
            styles.bubble,
            isPending ? styles.pending : styles.answered,
            { opacity: pulse, transform: [{ scale: pop }] },
          ]}
        >
          <Text
            style={[
              typography.body,
              isPending ? styles.pendingText : styles.answeredText,
            ]}
          >
            {isPending ? PENDING_TEXT : text}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    transformOrigin: 'right bottom',
  },
  bubble: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    transformOrigin: 'right center',
  },
  pending: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.iosBlue,
    // Keeps the same outer size as an answered bubble.
    paddingHorizontal: spacing.md - 1.5,
    paddingVertical: spacing.xs - 1.5,
  },
  answered: {
    backgroundColor: colors.iosBlue,
  },
  pressed: {
    opacity: 0.7,
  },
  pendingText: {
    color: colors.iosBlue,
  },
  answeredText: {
    color: colors.white,
  },
});

export default React.memo(AnswerBubble);
