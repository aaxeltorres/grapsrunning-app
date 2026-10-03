import React from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme';
import ChatBubble from './ChatBubble';
import MikeAvatar from './MikeAvatar';

type Props = {
  /** What Mike says. Without a message the card is hidden. */
  message?: string;
  reduceMotion?: boolean;
};

/**
 * Coach Mike's card: his avatar and a chat bubble. It only draws the
 * message it is given, so what he says can change without touching the
 * layout of the screen that hosts it.
 */
export default function MikeCard({ message, reduceMotion = false }: Props) {
  if (!message) return null;

  return (
    <View style={styles.row}>
      <MikeAvatar size={32} style={styles.avatar} />
      <View style={styles.body}>
        <ChatBubble
          text={message}
          sender="mike"
          animateOnMount={false}
          reduceMotion={reduceMotion}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  avatar: {
    marginBottom: spacing.xxs,
  },
  body: {
    flex: 1,
  },
});
