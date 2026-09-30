import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';
import TopBar from '../components/TopBar';
import MikeAvatar from '../components/MikeAvatar';
import OnboardingChat from '../components/OnboardingChat';
import { planOnboardingScript } from '../coach/planOnboardingScript';
import { usePlanOnboarding } from '../hooks/usePlanOnboarding';
import { successNotification } from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Plan'>;

/**
 * Training plan section. On the first visit Mike runs a chat onboarding;
 * afterwards the plan itself will live here.
 */
export default function PlanScreen({}: Props) {
  const { status, markDone, reset } = usePlanOnboarding();
  // Bumped on dev reset to remount the chat and replay it from the start.
  const [chatRun, setChatRun] = useState(0);

  const handleDevReset = useCallback(async () => {
    await reset();
    setChatRun((run) => run + 1);
    successNotification();
  }, [reset]);

  return (
    // Bottom inset is applied inside the chat so messages scroll under the home indicator.
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <TopBar
        title="Plan"
        // Dev-only: long-press the title to replay the onboarding.
        onTitleLongPress={__DEV__ ? handleDevReset : undefined}
      />

      {status === 'pending' && (
        <OnboardingChat
          key={chatRun}
          script={planOnboardingScript}
          onComplete={markDone}
        />
      )}

      {status === 'done' && (
        <View style={styles.emptyState}>
          <MikeAvatar size={64} />
          <Text style={[typography.title2, styles.emptyTitle]}>
            Your plan is on its way
          </Text>
          <Text style={[typography.body, styles.emptyBody]}>
            Mike is putting your training plan together. It will show up here
            soon.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
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
  },
  emptyBody: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
