import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import {
  firstUnanswered,
  getAnswer,
  isQuestionStep,
  isSameAnswer,
  profileRows,
  withAnswer,
} from '../coach/conversation';
import { generatePlan, regeneratePlan } from '../coach/generatePlan';
import {
  planOnboardingScript,
  profileScreenMessage,
} from '../coach/planOnboardingScript';
import {
  planAnswersChanged,
  type QuestionId,
  type RunnerProfile,
} from '../coach/runnerProfile';
import type { AnswerValue, QuestionStep } from '../coach/types';
import AnswerRow from '../components/AnswerRow';
import AnswerSheet from '../components/AnswerSheet';
import BottomSheet from '../components/BottomSheet';
import Button from '../components/Button';
import ChatBubble from '../components/ChatBubble';
import MikeAvatar from '../components/MikeAvatar';
import TopBar from '../components/TopBar';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { planStorage } from '../storage/planStorage';
import { profileStorage } from '../storage/profileStorage';
import { colors, radius, spacing, typography } from '../theme';
import { lightImpact, successNotification } from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;
type LeaveAction = Parameters<Props['navigation']['dispatch']>[0];

const UNANSWERED_LABEL = 'Not answered';

type SheetState = {
  questionId: QuestionId | null;
  visible: boolean;
  /** Visible or still animating out. */
  active: boolean;
  /** Bumped on every open so the sheet starts from a fresh draft. */
  openCount: number;
};

const questions = new Map<QuestionId, QuestionStep>();
planOnboardingScript
  .filter(isQuestionStep)
  .forEach((question) => questions.set(question.id, question));

/**
 * "Your profile": every onboarding answer in a list, each one editable
 * through the same answer sheets as Mike's chat. Answers save as soon as
 * a sheet is confirmed. When goal, level, speed work, training days or
 * injuries changed, leaving the screen offers to update the plan.
 */
export default function ProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  const [profile, setProfile] = useState<RunnerProfile | null>(null);
  // Answers as they were when the screen opened, to tell if the plan
  // needs an update when leaving.
  const baselineRef = useRef<RunnerProfile | null>(null);
  // Latest saved profile: runs ahead of `profile` while a sheet closes.
  const savedRef = useRef<RunnerProfile | null>(null);

  useEffect(() => {
    let active = true;
    profileStorage
      .get()
      .then((stored) => {
        if (!active) return;
        baselineRef.current = stored;
        savedRef.current = stored;
        setProfile(stored);
      })
      .catch((error) => console.warn('Failed to load runner profile', error));
    return () => {
      active = false;
    };
  }, []);

  const [sheet, setSheet] = useState<SheetState>({
    questionId: null,
    visible: false,
    active: false,
    openCount: 0,
  });
  // Question to ask as soon as the current sheet has closed: a follow-up
  // that became necessary because of the answer just given.
  const followUpRef = useRef<QuestionId | null>(null);

  const openSheet = useCallback((questionId: QuestionId) => {
    setSheet((current) =>
      current.active
        ? current
        : {
            questionId,
            visible: true,
            active: true,
            openCount: current.openCount + 1,
          },
    );
  }, []);

  const handleConfirm = (value: AnswerValue) => {
    const question = sheet.questionId && questions.get(sheet.questionId);
    const saved = savedRef.current;
    if (!sheet.visible || !question || !saved) return;

    if (!isSameAnswer(getAnswer(question, saved), value)) {
      const next = withAnswer(planOnboardingScript, saved, question, value);
      savedRef.current = next;
      setProfile(next);
      profileStorage
        .save(next)
        .catch((error) => console.warn('Failed to save runner profile', error));
      followUpRef.current =
        firstUnanswered(planOnboardingScript, next)?.id ?? null;
    }
    setSheet((current) => ({ ...current, visible: false }));
  };

  const handleDismiss = () => {
    followUpRef.current = null;
    setSheet((current) => ({ ...current, visible: false }));
  };

  const handleSheetClosed = () => {
    const followUp = followUpRef.current;
    followUpRef.current = null;
    setSheet((current) => ({ ...current, visible: false, active: false }));
    if (followUp) {
      // Wait a frame so the closed sheet has unmounted before reopening.
      requestAnimationFrame(() => openSheet(followUp));
    }
  };

  // Leaving: when the answers behind the plan changed, ask about the plan
  // first. The leave action is held until the user chooses.
  const [syncVisible, setSyncVisible] = useState(false);
  const [updating, setUpdating] = useState(false);
  const leaveActionRef = useRef<LeaveAction | null>(null);
  const allowLeaveRef = useRef(false);

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        const baseline = baselineRef.current;
        const current = savedRef.current;
        if (
          allowLeaveRef.current ||
          !baseline ||
          !current ||
          !planAnswersChanged(baseline, current)
        ) {
          return;
        }
        event.preventDefault();
        leaveActionRef.current = event.data.action;
        setSyncVisible(true);
      }),
    [navigation],
  );

  const leave = () => {
    allowLeaveRef.current = true;
    const action = leaveActionRef.current;
    if (action) navigation.dispatch(action);
    else navigation.goBack();
  };

  const handleUpdatePlan = async () => {
    const current = savedRef.current;
    if (!current || updating) return;
    setUpdating(true);
    try {
      const plan = await planStorage.get().catch(() => null);
      const updated = plan
        ? await regeneratePlan(plan, current)
        : await generatePlan(current);
      await planStorage.save(updated);
      successNotification();
    } catch (error) {
      console.warn('Failed to update plan', error);
    }
    setUpdating(false);
    setSyncVisible(false);
    leave();
  };

  const handleKeepPlan = () => {
    if (updating) return;
    lightImpact();
    setSyncVisible(false);
    leave();
  };

  const rows = useMemo(
    () =>
      profile
        ? profileRows(planOnboardingScript, profile, UNANSWERED_LABEL)
        : [],
    [profile],
  );
  const sheetQuestion = sheet.questionId
    ? (questions.get(sheet.questionId) ?? null)
    : null;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <TopBar
        title="Your profile"
        onBack={() => navigation.goBack()}
        right={null}
      />

      {profile ? (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.mikeRow}>
            <MikeAvatar />
            <View style={styles.mikeBubble}>
              <ChatBubble
                text={profileScreenMessage}
                sender="mike"
                reduceMotion={reduceMotion}
              />
            </View>
          </View>

          <View style={styles.list}>
            {rows.map((row, index) => (
              <AnswerRow
                key={row.questionId}
                label={row.label}
                value={row.value}
                divider={index > 0}
                onPress={() => openSheet(row.questionId)}
              />
            ))}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      )}

      <AnswerSheet
        question={sheetQuestion}
        initialValue={
          sheetQuestion && savedRef.current
            ? getAnswer(sheetQuestion, savedRef.current)
            : undefined
        }
        visible={sheet.visible}
        contentKey={sheet.openCount}
        onConfirm={handleConfirm}
        onDismiss={handleDismiss}
        onClosed={handleSheetClosed}
        reduceMotion={reduceMotion}
      />

      <BottomSheet
        visible={syncVisible}
        // Tapping outside stays on the screen.
        onDismiss={() => {
          if (!updating) setSyncVisible(false);
        }}
        reduceMotion={reduceMotion}
      >
        <View style={styles.syncHeader}>
          <Text style={[typography.title2, styles.syncTitle]}>
            Update your plan with these changes?
          </Text>
          <Text style={[typography.subheadline, styles.syncBody]}>
            Only workouts that are still ahead, planned and not edited will
            change.
          </Text>
        </View>
        <Button
          label="Update plan"
          variant="accent"
          loading={updating}
          onPress={handleUpdatePlan}
        />
        <Button
          label="Keep current plan"
          variant="secondary"
          disabled={updating}
          onPress={handleKeepPlan}
          style={styles.keepButton}
        />
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    gap: spacing.lg,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mikeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  mikeBubble: {
    flex: 1,
  },
  list: {
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
  },
  syncHeader: {
    gap: spacing.xxs,
    marginBottom: spacing.lg,
  },
  syncTitle: {
    color: colors.textPrimary,
  },
  syncBody: {
    color: colors.textSecondary,
  },
  keepButton: {
    marginTop: spacing.xs,
  },
});
