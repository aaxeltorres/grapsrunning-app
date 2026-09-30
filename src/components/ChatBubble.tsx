import React from 'react';
import { Animated, StyleSheet, Text, ViewStyle } from 'react-native';
import type { ChatSender } from '../coach/types';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';
import { colors, radius, spacing, typography } from '../theme';

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
function ChatBubble({
  text,
  sender,
  isFirstInGroup = true,
  isLastInGroup = true,
  animateOnMount = true,
  reduceMotion = false,
}: Props) {
  const isMike = sender === 'mike';
  const entrance = useEntranceAnimation({
    animate: animateOnMount,
    reduceMotion,
    offsetY: 10,
    fromScale: 0.92,
  });

  return (
    <Animated.View
      accessible
      accessibilityLabel={`${isMike ? 'Mike' : 'You'}: ${text}`}
      style={[
        styles.bubble,
        isMike ? styles.incoming : styles.outgoing,
        bubbleCorners(sender, isFirstInGroup, isLastInGroup),
        entrance,
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

export default React.memo(ChatBubble);
