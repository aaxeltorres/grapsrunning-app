import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { motion } from '../theme';

/** Delay between one section starting to appear and the next. */
const STAGGER_MS = 70;
const SLIDE_PX = 12;

/**
 * Entrance for a screen made of sections: each one fades in and slides up
 * slightly, one after another. With Reduce Motion they fade in together,
 * without sliding. Returns one Animated style per section; `count` is read
 * on mount, so keep the number of sections fixed.
 */
export function useStaggeredEntrance(count: number, reduceMotion: boolean) {
  const values = useRef<Animated.Value[]>([]);
  while (values.current.length < count) {
    values.current.push(new Animated.Value(0));
  }

  useEffect(() => {
    const timings = values.current.slice(0, count).map((value) =>
      Animated.timing(value, {
        toValue: 1,
        duration: motion.durationEnter,
        easing: motion.easeStandard,
        useNativeDriver: true,
      }),
    );
    const entrance = reduceMotion
      ? Animated.parallel(timings)
      : Animated.stagger(STAGGER_MS, timings);
    entrance.start();
    return () => entrance.stop();
    // Plays once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return values.current.slice(0, count).map((value) => ({
    opacity: value,
    transform: [
      {
        translateY: reduceMotion
          ? 0
          : value.interpolate({ inputRange: [0, 1], outputRange: [SLIDE_PX, 0] }),
      },
    ],
  }));
}
