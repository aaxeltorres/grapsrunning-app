import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
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
import {
  createNewPlan,
  generatePlan,
  regeneratePlan,
} from '../coach/generatePlan';
import {
  planCreatedMessage,
  planOnboardingScript,
  profileScreenMessage,
} from '../coach/planOnboardingScript';
import {
  planAnswersChanged,
  planLengthChanged,
  type IntensityById,
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
import OptionTile from '../components/OptionTile';
import TopBar from '../components/TopBar';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { planStorage } from '../storage/planStorage';
import { profileStorage } from '../storage/profileStorage';
import { colors, radius, spacing, typography } from '../theme';
import { lightImpact, successNotification } from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;
type LeaveAction = Parameters<Props['navigation']['dispatch']>[0];

const UNANSWERED_LABEL = 'Not answered';

const INTENSITY_LABELS: Record<IntensityById, string> = {
  pace: 'Pace',
  heartRate: 'Heart rate',
};

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
 * a sheet is confirmed. When goal, level, speed work, training days, plan
 * length or injuries changed, leaving the screen offers to update the plan
 * or to create a new one (first, when the plan length changed); a row at
 * the bottom creates a new plan on demand.
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
  // The plan length changed: only a new plan really follows it, so the
  // sheet leads with "Create a new plan".
  const [lengthChanged, setLengthChanged] = useState(false);
  // Which plan action is running, if any.
  const [busy, setBusy] = useState<'update' | 'create' | null>(null);
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
        setLengthChanged(planLengthChanged(baseline, current));
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

  // Tells the Plan screen (below this one in the stack) that Mike should
  // announce the new plan. The held leave action is left as it is.
  const announceNewPlan = () => {
    const planRoute = navigation
      .getState()
      .routes.find((route) => route.name === 'Plan');
    if (!planRoute) return;
    navigation.dispatch({
      ...CommonActions.setParams({ planCreated: true }),
      source: planRoute.key,
    });
  };

  // Runs the chosen plan action, saves the result and leaves. A failure is
  // logged and the user still leaves, with the plan as it was.
  const syncPlanAndLeave = async (kind: 'update' | 'create') => {
    const current = savedRef.current;
    if (!current || busy) return;
    setBusy(kind);
    try {
      const plan = await planStorage.get().catch(() => null);
      const next =
        kind === 'create'
          ? await createNewPlan(plan, current)
          : plan
            ? await regeneratePlan(plan, current)
            : await generatePlan(current);
      await planStorage.save(next);
      if (kind === 'create') announceNewPlan();
      successNotification();
    } catch (error) {
      console.warn(`Failed to ${kind} plan`, error);
    }
    setBusy(null);
    setSyncVisible(false);
    leave();
  };

  const handleUpdatePlan = () => syncPlanAndLeave('update');
  const handleCreatePlan = () => syncPlanAndLeave('create');

  type ButtonVariant = React.ComponentProps<typeof Button>['variant'];
  type ButtonStyle = React.ComponentProps<typeof Button>['style'];
  const updatePlanButton = (variant: ButtonVariant, style?: ButtonStyle) => (
    <Button
      label="Update plan"
      variant={variant}
      loading={busy === 'update'}
      disabled={busy === 'create'}
      onPress={handleUpdatePlan}
      style={style}
    />
  );
  const createPlanButton = (variant: ButtonVariant, style?: ButtonStyle) => (
    <Button
      label="Create a new plan"
      variant={variant}
      loading={busy === 'create'}
      disabled={busy === 'update'}
      onPress={handleCreatePlan}
      style={style}
    />
  );

  const handleKeepPlan = () => {
    if (busy) return;
    lightImpact();
    setSyncVisible(false);
    leave();
  };

  // "Create a new plan" on demand, from the row at the bottom.
  const [createVisible, setCreateVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [mikeLine, setMikeLine] = useState(profileScreenMessage);

  const openCreate = () => {
    if (sheet.active || busy) return;
    setCreateVisible(true);
  };

  const handleCreateNow = async () => {
    const current = savedRef.current;
    if (!current || creating) return;
    setCreating(true);
    try {
      const plan = await planStorage.get().catch(() => null);
      await planStorage.save(await createNewPlan(plan, current));
      // The plan matches the answers now: leaving needs no plan update.
      baselineRef.current = current;
      setMikeLine(planCreatedMessage);
      successNotification();
    } catch (error) {
      console.warn('Failed to create plan', error);
    }
    setCreating(false);
    setCreateVisible(false);
  };

  // "Intensity by": a setting, saved right away. It never makes the plan
  // out of date, so leaving afterwards doesn't offer a plan update.
  const [intensityVisible, setIntensityVisible] = useState(false);
  const [heartRateTapped, setHeartRateTapped] = useState(false);

  const openIntensity = () => {
    if (sheet.active) return;
    setHeartRateTapped(false);
    setIntensityVisible(true);
  };

  const choosePace = () => {
    lightImpact();
    const saved = savedRef.current;
    if (saved && saved.intensityBy !== 'pace') {
      const next: RunnerProfile = { ...saved, intensityBy: 'pace' };
      savedRef.current = next;
      setProfile(next);
      profileStorage
        .save(next)
        .catch((error) => console.warn('Failed to save runner profile', error));
    }
    setIntensityVisible(false);
  };

  // Heart rate isn't available yet: say so and keep pace.
  const chooseHeartRate = () => {
    lightImpact();
    setHeartRateTapped(true);
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
                key={mikeLine}
                text={mikeLine}
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

          <View style={styles.section}>
            <Text
              accessibilityRole="header"
              style={[typography.subheadline, styles.sectionTitle]}
            >
              Training
            </Text>
            <View style={styles.list}>
              <AnswerRow
                label="Intensity by"
                value={INTENSITY_LABELS[profile.intensityBy ?? 'pace']}
                onPress={openIntensity}
              />
            </View>
          </View>

          <View style={styles.list}>
            <AnswerRow
              label="Create a new plan"
              onPress={openCreate}
            />
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
        visible={intensityVisible}
        onDismiss={() => setIntensityVisible(false)}
        dragAnywhere
        reduceMotion={reduceMotion}
      >
        <View style={styles.syncHeader}>
          <Text style={[typography.title2, styles.syncTitle]}>Intensity by</Text>
          <Text style={[typography.subheadline, styles.syncBody]}>
            How your training zones are measured.
          </Text>
        </View>
        <View style={styles.options}>
          <OptionTile label="Pace" role="radio" selected onPress={choosePace} />
          <OptionTile
            label="Heart rate"
            role="radio"
            selected={false}
            onPress={chooseHeartRate}
          />
        </View>
        {heartRateTapped && (
          <Text
            accessibilityLiveRegion="polite"
            style={[typography.subheadline, styles.comingSoon]}
          >
            Coming soon. Heart rate zones need a heart rate sensor, so your zones
            stay on pace for now.
          </Text>
        )}
        <Button label="Done" variant="secondary" onPress={choosePace} />
      </BottomSheet>

      <BottomSheet
        visible={syncVisible}
        // Tapping outside stays on the screen.
        onDismiss={() => {
          if (!busy) setSyncVisible(false);
        }}
        dragAnywhere
        reduceMotion={reduceMotion}
      >
        <View style={styles.syncHeader}>
          <Text style={[typography.title2, styles.syncTitle]}>
            Update your plan with these changes?
          </Text>
          <Text style={[typography.subheadline, styles.syncBody]}>
            {lengthChanged
              ? 'You changed your plan length. Create a new plan starts it fresh this week, one week or four weeks ahead. '
              : ''}
            Update plan changes only workouts that are still ahead, planned and
            not edited. Create a new plan rebuilds every planned workout from
            today on, edited ones included. Finished and skipped workouts stay.
          </Text>
        </View>
        {lengthChanged ? (
          <>
            {createPlanButton('accent')}
            {updatePlanButton('secondary', styles.keepButton)}
          </>
        ) : (
          <>
            {updatePlanButton('accent')}
            {createPlanButton('secondary', styles.keepButton)}
          </>
        )}
        <Button
          label="Keep current plan"
          variant="secondary"
          disabled={busy !== null}
          onPress={handleKeepPlan}
          style={styles.keepButton}
        />
      </BottomSheet>

      <BottomSheet
        visible={createVisible}
        onDismiss={() => {
          if (!creating) setCreateVisible(false);
        }}
        dragAnywhere
        reduceMotion={reduceMotion}
      >
        <View style={styles.syncHeader}>
          <Text style={[typography.title2, styles.syncTitle]}>
            Create a new plan?
          </Text>
          <Text style={[typography.subheadline, styles.syncBody]}>
            Mike will rebuild every planned workout from today on using your
            current answers. Workouts you edited will be replaced. Finished and
            skipped workouts and their results stay.
          </Text>
        </View>
        <Button
          label="Create a new plan"
          variant="accent"
          loading={creating}
          onPress={handleCreateNow}
        />
        <Button
          label="Cancel"
          variant="secondary"
          disabled={creating}
          onPress={() => setCreateVisible(false)}
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
  section: {
    gap: spacing.xs,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  options: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  comingSoon: {
    color: colors.planCardAccent,
    marginBottom: spacing.md,
  },
});
