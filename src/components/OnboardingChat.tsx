import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ChatMessage, ChatScriptStep, ChatSender } from '../coach/types';
import { useChatScript } from '../hooks/useChatScript';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { lightImpact } from '../utils/haptics';
import { motion, spacing } from '../theme';
import ChatBubble from './ChatBubble';
import MikeAvatar from './MikeAvatar';
import TypingIndicator from './TypingIndicator';

const AVATAR_FADE_MS = 150;

type Props = {
  /** Script to play. Must be a stable reference, e.g. a module constant. */
  script: ChatScriptStep[];
  onComplete?: () => void;
};

type MessageGroup = {
  sender: ChatSender;
  messages: ChatMessage[];
  /** Mike is typing the next message of this group. */
  showTyping: boolean;
};

/** Consecutive messages from the same sender share one group and avatar. */
function groupMessages(
  messages: ChatMessage[],
  isTyping: boolean,
): MessageGroup[] {
  const groups: MessageGroup[] = [];

  for (const message of messages) {
    const last = groups[groups.length - 1];
    if (last && last.sender === message.sender) {
      last.messages.push(message);
    } else {
      groups.push({ sender: message.sender, messages: [message], showTyping: false });
    }
  }

  if (isTyping) {
    const last = groups[groups.length - 1];
    if (last && last.sender === 'mike') {
      last.showTyping = true;
    } else {
      groups.push({ sender: 'mike', messages: [], showTyping: true });
    }
  }

  return groups;
}

/**
 * Coach Mike's scripted chat: plays the script with typing indicators,
 * animated arrivals, haptics and auto-scroll to the latest message.
 */
export default function OnboardingChat({ script, onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const scrollRef = useRef<ScrollView>(null);

  const { messages, isTyping } = useChatScript(script, {
    onMessage: lightImpact,
    onComplete,
  });

  const groups = useMemo(
    () => groupMessages(messages, isTyping),
    [messages, isTyping],
  );

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
      onContentSizeChange={() =>
        scrollRef.current?.scrollToEnd({ animated: !reduceMotion })
      }
    >
      {groups.map((group, index) => (
        // Groups only ever get appended, so the index is a stable key and
        // the avatar stays mounted while a bubble replaces the indicator.
        <ChatGroup key={index} group={group} reduceMotion={reduceMotion} />
      ))}
    </ScrollView>
  );
}

function ChatGroup({
  group,
  reduceMotion,
}: {
  group: MessageGroup;
  reduceMotion: boolean;
}) {
  const isMike = group.sender === 'mike';
  const lastIndex = group.messages.length - 1;

  return (
    <View style={styles.group}>
      {isMike && <FadingAvatar />}
      <View style={styles.bubbles}>
        {group.messages.map((message, index) => (
          <ChatBubble
            key={message.id}
            text={message.text}
            sender={message.sender}
            isFirstInGroup={index === 0}
            isLastInGroup={index === lastIndex && !group.showTyping}
            reduceMotion={reduceMotion}
          />
        ))}
        {group.showTyping && (
          <TypingIndicator
            isFirstInGroup={group.messages.length === 0}
            reduceMotion={reduceMotion}
          />
        )}
      </View>
    </View>
  );
}

/** Mike's avatar, faded in when his first bubble of a group appears. */
function FadingAvatar() {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fade = Animated.timing(opacity, {
      toValue: 1,
      duration: AVATAR_FADE_MS,
      easing: motion.easeStandard,
      useNativeDriver: true,
    });
    fade.start();
    return () => fade.stop();
  }, [opacity]);

  return (
    <Animated.View style={{ opacity }}>
      <MikeAvatar />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  bubbles: {
    flex: 1,
    gap: spacing.xxs,
  },
});
