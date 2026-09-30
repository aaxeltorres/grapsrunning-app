import { useEffect, useMemo, useRef } from 'react';
import { Animated } from 'react-native';
import { motion } from '../theme';

const FADE_IN_MS = 180;

type Options = {
  /** Play on mount. When false the element renders in its final state. */
  animate: boolean;
  reduceMotion: boolean;
  /** Start this many points lower, then spring up. */
  offsetY?: number;
  /** Start at this scale, then spring to 1. */
  fromScale?: number;
};

/**
 * Chat arrival animation: a quick fade plus a slight slide-up/scale
 * spring. With Reduce Motion only the fade remains.
 * Returns an Animated style for the element's root view.
 */
export function useEntranceAnimation({
  animate,
  reduceMotion,
  offsetY = 0,
  fromScale = 1,
}: Options) {
  const opacity = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const enter = useRef(
    new Animated.Value(animate && !reduceMotion ? 0 : 1),
  ).current;

  useEffect(() => {
    if (!animate) return;

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
    // Arrival animation runs once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useMemo(
    () => ({
      opacity,
      transform: [
        {
          translateY: enter.interpolate({
            inputRange: [0, 1],
            outputRange: [offsetY, 0],
          }),
        },
        {
          scale: enter.interpolate({
            inputRange: [0, 1],
            outputRange: [fromScale, 1],
          }),
        },
      ],
    }),
    [opacity, enter, offsetY, fromScale],
  );
}
