import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { motion, radius, spacing } from '../theme';

const PULSE_MS = 700;
const PULSE_MIN = 0.08;
const PULSE_MAX = 0.22;
const PULSE_STATIC = 0.14;
const ALERT_FADE_MS = 200;

type Props = {
  alert: boolean;
  reduceMotion: boolean;
  /** Theme-interpolated alert red (light while paused, dark while running). */
  red: Animated.AnimatedInterpolation<string | number>;
  children: React.ReactNode;
};

/**
 * A metric's block on the run screen. While `alert` is on, a red tint
 * pulses softly behind it (steady with Reduce Motion), and fades out when
 * it clears. Visual only: no text, sound or haptics.
 */
export default function AlertBlock({ alert, reduceMotion, red, children }: Props) {
  const tint = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timing = (toValue: number, duration: number) =>
      Animated.timing(tint, {
        toValue,
        duration,
        easing: motion.easeStandard,
        useNativeDriver: true,
      });

    const animation = !alert
      ? timing(0, ALERT_FADE_MS)
      : reduceMotion
        ? timing(PULSE_STATIC, ALERT_FADE_MS)
        : Animated.loop(
            Animated.sequence([
              timing(PULSE_MAX, PULSE_MS),
              timing(PULSE_MIN, PULSE_MS),
            ]),
          );
    animation.start();
    return () => animation.stop();
  }, [alert, reduceMotion, tint]);

  return (
    <View style={styles.block}>
      {/* Native-driven opacity outside, theme-driven color inside. */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: tint }]}
      >
        <Animated.View style={[styles.tint, { backgroundColor: red }]} />
      </Animated.View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    overflow: 'hidden',
  },
  tint: {
    flex: 1,
  },
});
