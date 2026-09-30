import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, ViewStyle } from 'react-native';
import type { ChatSender } from '../coach/types';
import { colors, motion, radius, spacing, typography } from '../theme';

const FADE_IN_MS = 180;
const ENTER_OFFSET_Y = 10;
const ENTER_SCALE = 0.92;

type Props = {
  text: string;
  sender: ChatSender;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  /** Play the arrival animation on mount. Disable for restored history. */
  animateOnMount?: boolean;
  reduceMotion?: boolean;
};

/**
 * iMessage-style corners: fully rounded at the edges of a group, tighter
 * where consecutive bubbles from the same sender stack.
 */
export function bubbleCorners(
  sender: ChatSender,
  isFirstInGroup: boolean,
  isLastInGroup: boolean,
): ViewStyle {
  const top = isFirstInGroup ? radius.lg : radius.sm;
  const bottom = isLastInGroup ? radius.lg : radius.sm;
  return sender === 'mike'
    ? { borderTopLeftRadius: top, borderBottomLeftRadius: bottom }
    : { borderTopRightRadius: top, borderBottomRightRadius: bottom };
}

/**
 * A single chat message. Mike's bubbles sit on the left in gray; the
 * user's sit on the right in blue.
 */
export default function ChatBubble({
  text,
  sender,
  isFirstInGroup = true,
  isLastInGroup = true,
  animateOnMount = true,
  reduceMotion = false,
}: Props) {
  const isMike = sender === 'mike';
  const opacity = useRef(new Animated.Value(animateOnMount ? 0 : 1)).current;
  // Reduce Motion keeps the fade but drops the slide and scale.
  const enter = useRef(
    new Animated.Value(animateOnMount && !reduceMotion ? 0 : 1),
  ).current;

  useEffect(() => {
    if (!animateOnMount) return;

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

  return (
    <Animated.View
      accessible
      accessibilityLabel={`${isMike ? 'Mike' : 'You'}: ${text}`}
      style={[
        styles.bubble,
        isMike ? styles.incoming : styles.outgoing,
        bubbleCorners(sender, isFirstInGroup, isLastInGroup),
        {
          opacity,
          transform: [
            {
              translateY: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [ENTER_OFFSET_Y, 0],
              }),
            },
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
      <Text
        style={[
          typography.body,
          isMike ? styles.incomingText : styles.outgoingText,
        ]}
      >
        {text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '82%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  // Scale grows out of the corner nearest the sender, like iMessage.
  incoming: {
    alignSelf: 'flex-start',
    backgroundColor: colors.chatBubbleIncoming,
    transformOrigin: 'left bottom',
  },
  outgoing: {
    alignSelf: 'flex-end',
    backgroundColor: colors.iosBlue,
    transformOrigin: 'right bottom',
  },
  incomingText: {
    color: colors.textPrimary,
  },
  outgoingText: {
    color: colors.white,
  },
});
