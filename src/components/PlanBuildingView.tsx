import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import {
  planBuildFailedMessage,
  planBuildingMessage,
} from '../coach/planOnboardingScript';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';
import { colors, spacing } from '../theme';
import Button from './Button';
import ChatBubble from './ChatBubble';
import MikeAvatar from './MikeAvatar';
import TypingIndicator from './TypingIndicator';

type Props = {
  /** `building`: Mike at work. `error`: it failed and the old plan is kept. */
  state: 'building' | 'error';
  reduceMotion: boolean;
  onRetry: () => void;
  onCancel: () => void;
};

/**
 * Full-screen state shown while "Create a new plan" runs. A plain view over
 * the screen, never a Modal, so nothing native is left presented when the
 * screen is popped afterwards. It swallows touches, so the screen below
 * can't be used meanwhile. With Reduce Motion it is static text only.
 */
export default function PlanBuildingView({
  state,
  reduceMotion,
  onRetry,
  onCancel,
}: Props) {
  const entrance = useEntranceAnimation({ animate: true, reduceMotion });
  const failed = state === 'error';
  const line = failed ? planBuildFailedMessage : planBuildingMessage;

  return (
    <Animated.View
      accessibilityViewIsModal
      accessibilityLiveRegion="polite"
      style={[styles.overlay, entrance]}
    >
      <View style={styles.column}>
        <MikeAvatar />
        <ChatBubble
          key={state}
          text={line}
          sender="mike"
          animateOnMount={!reduceMotion}
          reduceMotion={reduceMotion}
        />
        {!failed && !reduceMotion && <TypingIndicator reduceMotion={false} />}
        {failed && (
          <View style={styles.actions}>
            <Button label="Try again" variant="accent" onPress={onRetry} />
            <Button label="Not now" variant="secondary" onPress={onCancel} />
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  column: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  actions: {
    alignSelf: 'stretch',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
});
