import React, { useCallback, useRef, useState } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, motion, spacing, typography } from '../theme';
import TopBar from '../components/TopBar';
import MikeAvatar from '../components/MikeAvatar';
import OnboardingChat from '../components/OnboardingChat';
import { generatePlan } from '../coach/generatePlan';
import { planOnboardingScript } from '../coach/planOnboardingScript';
import type { RunnerProfile } from '../coach/runnerProfile';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';
import { usePlanOnboarding } from '../hooks/usePlanOnboarding';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { successNotification } from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Plan'>;

const CHAT_EXIT_MS = 280;
const CHAT_EXIT_OFFSET = -16;

/**
 * Training plan section. On the first visit Mike runs a chat onboarding
 * (resumed where the user left off); afterwards the plan will live here.
 */
export default function PlanScreen({}: Props) {
  const { status, profile, markDone, finish, reset } = usePlanOnboarding();
  const reduceMotion = useReduceMotion();
  // Bumped on dev reset to remount the chat and replay it from the start.
  const [chatRun, setChatRun] = useState(0);
  // The plan view animates in only when arriving from the chat.
  const [cameFromChat, setCameFromChat] = useState(false);
  const chatExit = useRef(new Animated.Value(0)).current;
  const isLeavingChatRef = useRef(false);

  const handleDevReset = useCallback(async () => {
    await reset();
    isLeavingChatRef.current = false;
    chatExit.setValue(0);
    setCameFromChat(false);
    setChatRun((run) => run + 1);
    successNotification();
  }, [reset, chatExit]);

  const handleConfirm = useCallback(
    (confirmedProfile: RunnerProfile) => {
      markDone();
      // TODO: keep the plan once the Plan UI exists.
      generatePlan(confirmedProfile).catch((error) =>
        console.warn('Failed to generate plan', error),
      );
    },
    [markDone],
  );

  const handleChatComplete = useCallback(() => {
    if (isLeavingChatRef.current) return;
    isLeavingChatRef.current = true;
    Animated.timing(chatExit, {
      toValue: 1,
      duration: CHAT_EXIT_MS,
      easing: motion.easeStandard,
      useNativeDriver: true,
    }).start(() => {
      setCameFromChat(true);
      finish();
      successNotification();
    });
  }, [chatExit, finish]);

  const chatExitStyle = {
    opacity: chatExit.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
    }),
    transform: reduceMotion
      ? []
      : [
          {
            translateY: chatExit.interpolate({
              inputRange: [0, 1],
              outputRange: [0, CHAT_EXIT_OFFSET],
            }),
          },
        ],
  };

  return (
    // Bottom inset is applied inside the chat so messages scroll under the home indicator.
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <TopBar
        title="Plan"
        // Dev-only: long-press the title to replay the onboarding.
        onTitleLongPress={__DEV__ ? handleDevReset : undefined}
      />

      {status === 'pending' && (
        <Animated.View style={[styles.fill, chatExitStyle]}>
          <OnboardingChat
            key={chatRun}
            script={planOnboardingScript}
            initialProfile={profile}
            onConfirm={handleConfirm}
            onComplete={handleChatComplete}
          />
        </Animated.View>
      )}

      {status === 'done' && (
        <PlanOnTheWay animate={cameFromChat} reduceMotion={reduceMotion} />
      )}
    </SafeAreaView>
  );
}

/** Placeholder until the plan UI exists. */
function PlanOnTheWay({
  animate,
  reduceMotion,
}: {
  animate: boolean;
  reduceMotion: boolean;
}) {
  const entrance = useEntranceAnimation({
    animate,
    reduceMotion,
    offsetY: 24,
    fromScale: 0.96,
  });

  return (
    <Animated.View style={[styles.emptyState, entrance]}>
      <MikeAvatar size={64} />
      <Text style={[typography.title2, styles.emptyTitle]}>
        Your plan is on its way
      </Text>
      <Text style={[typography.body, styles.emptyBody]}>
        Mike is putting your training plan together. It will show up here
        soon.
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fill: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    color: colors.textPrimary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
