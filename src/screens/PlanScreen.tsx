import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, motion, typography } from '../theme';
import TopBar from '../components/TopBar';
import OnboardingChat from '../components/OnboardingChat';
import PlanOverview from '../components/PlanOverview';
import { planOnboardingScript } from '../coach/planOnboardingScript';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';
import { usePlanOnboarding } from '../hooks/usePlanOnboarding';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { todayISO } from '../utils/dates';
import { successNotification } from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Plan'>;

const CHAT_EXIT_MS = 280;
const CHAT_EXIT_OFFSET = -16;
const SETTINGS_BUTTON_SIZE = 34;

/**
 * Training plan section. On the first visit Mike runs a chat onboarding
 * (resumed where the user left off), which then turns into the plan.
 * Later visits open the plan directly.
 */
export default function PlanScreen({ navigation }: Props) {
  const { status, profile, plan, confirm, finish, reset } =
    usePlanOnboarding();
  const reduceMotion = useReduceMotion();
  const [today] = useState(todayISO);
  // Bumped on dev reset to remount the chat and replay it from the start.
  const [chatRun, setChatRun] = useState(0);
  // The plan animates in only when arriving from the chat.
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

  // No structured execution yet: every workout starts a free run.
  const handleStartWorkout = useCallback(
    () => navigation.navigate('ActiveRun'),
    [navigation],
  );

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
    // Bottom inset is applied inside the scroll views, so content scrolls
    // under the home indicator.
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <TopBar
        title="Plan"
        // Dev-only: long-press the title to replay the onboarding.
        onTitleLongPress={__DEV__ ? handleDevReset : undefined}
        right={status === 'done' ? <SettingsButton /> : undefined}
      />

      {status === 'pending' && (
        <Animated.View style={[styles.fill, chatExitStyle]}>
          <OnboardingChat
            key={chatRun}
            script={planOnboardingScript}
            initialProfile={profile}
            onConfirm={confirm}
            onComplete={handleChatComplete}
          />
        </Animated.View>
      )}

      {status === 'done' &&
        (plan ? (
          <EnterView animate={cameFromChat} reduceMotion={reduceMotion}>
            <PlanOverview
              plan={plan}
              today={today}
              gentle={profile.injuryStatus === 'hurts_now'}
              reduceMotion={reduceMotion}
              onStartWorkout={handleStartWorkout}
            />
          </EnterView>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.textSecondary} />
          </View>
        ))}
    </SafeAreaView>
  );
}

/** Gear placeholder: plan settings will open from here. */
function SettingsButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Plan settings"
      accessibilityHint="Coming soon"
      hitSlop={8}
      style={({ pressed }) => [
        styles.settingsButton,
        pressed && styles.settingsPressed,
      ]}
    >
      <Text
        maxFontSizeMultiplier={1.2}
        style={[typography.headline, styles.settingsIcon]}
      >
        ⚙︎
      </Text>
    </Pressable>
  );
}

/** Slides the plan up into place when it replaces the chat. */
function EnterView({
  animate,
  reduceMotion,
  children,
}: {
  animate: boolean;
  reduceMotion: boolean;
  children: React.ReactNode;
}) {
  const entrance = useEntranceAnimation({
    animate,
    reduceMotion,
    offsetY: 24,
  });
  return (
    <Animated.View style={[styles.fill, entrance]}>{children}</Animated.View>
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
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButton: {
    width: SETTINGS_BUTTON_SIZE,
    height: SETTINGS_BUTTON_SIZE,
    borderRadius: SETTINGS_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceGray,
  },
  settingsPressed: {
    opacity: 0.6,
  },
  settingsIcon: {
    color: colors.textPrimary,
  },
});
