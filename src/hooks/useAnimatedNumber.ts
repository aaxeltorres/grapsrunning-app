import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { motion } from '../theme';

const DURATION_MS = 240;

/**
 * A number that glides to its new value instead of jumping, for live
 * summaries. Returns the value to display right now.
 */
export function useAnimatedNumber(target: number, reduceMotion = false) {
  const value = useRef(new Animated.Value(target)).current;
  const [display, setDisplay] = useState(target);

  useEffect(() => {
    const id = value.addListener(({ value: next }) => setDisplay(next));
    return () => value.removeListener(id);
  }, [value]);

  useEffect(() => {
    if (reduceMotion) {
      value.setValue(target);
      return;
    }
    // Restarts from wherever the number is, so fast changes stay smooth.
    const animation = Animated.timing(value, {
      toValue: target,
      duration: DURATION_MS,
      easing: motion.easeStandard,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [target, reduceMotion, value]);

  return display;
}
