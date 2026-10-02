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
import { createNewPlan } from '../coach/generatePlan';
import {
  planNeedsRebuild,
  planReferenceAnswers,
  type Plan,
} from '../coach/plan';
import {
  planOnboardingScript,
  profileScreenMessage,
} from '../coach/planOnboardingScript';
import {
  planAnswersSnapshot,
  planLengthChanged,
  type PlanAnswersSnapshot,
  type QuestionId,
  type RunnerProfile,
} from '../coach/runnerProfile';
import type { AnswerValue, QuestionStep } from '../coach/types';
import AnswerRow from '../components/AnswerRow';
import AnswerSheet from '../components/AnswerSheet';
import BottomSheet from '../components/BottomSheet';
import Button from '../components/Button';
import ChatBubble from '../components/ChatBubble';
import IntensitySheet, { INTENSITY_LABELS } from '../components/IntensitySheet';
import MikeAvatar from '../components/MikeAvatar';
import PlanBuildingView from '../components/PlanBuildingView';
import TopBar from '../components/TopBar';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { planStorage } from '../storage/planStorage';
import { profileStorage } from '../storage/profileStorage';
import { colors, radius, spacing, typography } from '../theme';
import { lightImpact, successNotification } from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;
type LeaveAction = Parameters<Props['navigation']['dispatch']>[0];

const UNANSWERED_LABEL = 'Not answered';

// "Building your plan" stays at least this long, even if generation is instant.
const PLAN_BUILD_MIN_MS = 1200;
// A sheet that never reports it closed must not stall the flow.
const SHEET_CLOSE_FALLBACK_MS = 1000;

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * `closing`: Create a new plan was tapped and its sheet is closing.
 * `building`: the loading state. `error`: it failed, the old plan is kept.
 */
type BuildPhase = 'idle' | 'closing' | 'building' | 'error';

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
 * a sheet is confirmed. When the plan answers (goal, level, speed work,
 * training days, plan length, injuries) differ from the ones the saved plan
 * was built from (`Plan.basedOn`), leaving the screen offers to create a new
 * plan or keep the current one; a row at the bottom creates a new plan on
 * demand, through the same `createPlan`.
 */
export default function ProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  const [profile, setProfile] = useState<RunnerProfile | null>(null);
  // Plan answers as they were when the screen opened: only the reference
  // for plans saved before `Plan.basedOn` existed.
  const openedWithRef = useRef<PlanAnswersSnapshot | null>(null);
  // The saved plan. This screen is the only writer while it is open.
  const planRef = useRef<Plan | null>(null);
  // Latest saved profile: runs ahead of `profile` while a sheet closes.
  const savedRef = useRef<RunnerProfile | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([profileStorage.get(), planStorage.get().catch(() => null)])
      .then(([stored, storedPlan]) => {
        if (!active) return;
        openedWithRef.current = planAnswersSnapshot(stored);
        planRef.current = storedPlan;
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

  // Leaving: when the answers differ from the ones the plan was built from,
  // ask about the plan first. The leave action is held until the user chooses.
  const [syncVisible, setSyncVisible] = useState(false);
  // The plan length changed: the sheet says the new plan follows it.
  const [lengthChanged, setLengthChanged] = useState(false);
  // Where "Create a new plan" is. The ref is read by the leave check and by
  // double taps, which must see the change before the next render.
  const [phase, setPhase] = useState<BuildPhase>('idle');
  const phaseRef = useRef<BuildPhase>('idle');
  const changePhase = useCallback((next: BuildPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  // Set from the tap of Keep current plan until the screen is left.
  const keepingRef = useRef(false);
  const leaveActionRef = useRef<LeaveAction | null>(null);
  const allowLeaveRef = useRef(false);

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        const plan = planRef.current;
        const current = savedRef.current;
        if (allowLeaveRef.current) return;
        // Back swipe, back button or TopBar while the plan is being built:
        // it can't be cancelled safely, so the screen stays until it ends.
        if (phaseRef.current !== 'idle') {
          event.preventDefault();
          return;
        }
        if (!plan || !current) return;
        const answers = planAnswersSnapshot(current);
        const opened = openedWithRef.current ?? undefined;
        if (!planNeedsRebuild(plan, answers, opened)) return;
        event.preventDefault();
        leaveActionRef.current = event.data.action;
        const reference = planReferenceAnswers(plan, opened);
        setLengthChanged(
          reference ? planLengthChanged(reference, answers) : false,
        );
        setSyncVisible(true);
      }),
    [navigation],
  );

  // Re-arms the leave check if the screen stays mounted after a leave.
  useEffect(
    () =>
      navigation.addListener('focus', () => {
        allowLeaveRef.current = false;
      }),
    [navigation],
  );

  // No swipe-back while the plan is being built (beforeRemove also blocks it).
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: phase === 'idle' });
  }, [navigation, phase]);

  const leave = () => {
    const action = leaveActionRef.current;
    leaveActionRef.current = null;
    allowLeaveRef.current = true;
    if (action) navigation.dispatch(action);
    else navigation.goBack();
    // If the screen is still mounted afterwards, check again next time.
    setTimeout(() => {
      allowLeaveRef.current = false;
      keepingRef.current = false;
      if (phaseRef.current === 'building') changePhase('idle');
    }, 500);
  };

  // Runs `action` once a sheet has fully closed (its `onClosed`) plus one
  // frame: navigating while a Modal is still on screen or dismissing can
  // leave the next screen unable to receive touches.
  const afterCloseRef = useRef<(() => void) | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flushAfterClose = useCallback(() => {
    clearTimeout(closeTimerRef.current);
    const action = afterCloseRef.current;
    afterCloseRef.current = null;
    if (action) requestAnimationFrame(action);
  }, []);
  const runAfterSheetClosed = (action: () => void) => {
    afterCloseRef.current = action;
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(flushAfterClose, SHEET_CLOSE_FALLBACK_MS);
  };
  useEffect(() => () => clearTimeout(closeTimerRef.current), []);

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

  // The one way to build a new plan: from the current answers, keeping
  // finished and skipped workouts. Returns false when it failed.
  const createPlan = async () => {
    const current = savedRef.current;
    if (!current) return false;
    try {
      const plan = await planStorage.get().catch(() => planRef.current);
      const next = await createNewPlan(plan, current);
      await planStorage.save(next);
      planRef.current = next;
      return true;
    } catch (error) {
      console.warn('Failed to create plan', error);
      return false;
    }
  };

  // The plan being built: started on tap, awaited by the loading state.
  const workRef = useRef<Promise<boolean> | null>(null);

  // Both entry points (the leave sheet and the row at the bottom) start here.
  // Generation starts at once, the sheet closes, then the loading state holds
  // for at least PLAN_BUILD_MIN_MS and the screen returns to Plan, where Mike
  // announces the new plan.
  const startBuild = () => {
    if (phaseRef.current !== 'idle' || keepingRef.current) return;
    changePhase('closing');
    workRef.current = createPlan();
    runAfterSheetClosed(() => changePhase('building'));
    setSyncVisible(false);
    setCreateVisible(false);
  };

  useEffect(() => {
    if (phase !== 'building') return;
    let active = true;
    Promise.all([
      workRef.current ?? Promise.resolve(false),
      wait(PLAN_BUILD_MIN_MS),
    ]).then(([created]) => {
      if (!active) return;
      if (!created) {
        changePhase('error');
        return;
      }
      successNotification();
      announceNewPlan();
      leave();
    });
    return () => {
      active = false;
    };
    // announceNewPlan and leave only read refs and `navigation`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, changePhase]);

  const retryBuild = () => {
    if (phaseRef.current !== 'error') return;
    workRef.current = createPlan();
    changePhase('building');
  };

  // Back to Your profile with the old plan. The leave check still applies.
  const cancelBuild = () => {
    if (phaseRef.current !== 'error') return;
    leaveActionRef.current = null;
    workRef.current = null;
    changePhase('idle');
  };

  // Remembers the answers kept, so the sheet does not come back for them.
  // No loading: the sheet closes completely, then the screen is left.
  const handleKeepPlan = async () => {
    if (phaseRef.current !== 'idle' || keepingRef.current) return;
    keepingRef.current = true;
    lightImpact();
    const current = savedRef.current;
    if (current) {
      const kept = planAnswersSnapshot(current);
      try {
        const next = await planStorage.update((plan) => ({
          ...plan,
          keptAnswers: kept,
        }));
        if (next) planRef.current = next;
      } catch (error) {
        console.warn('Failed to save kept answers', error);
      }
    }
    runAfterSheetClosed(leave);
    setSyncVisible(false);
  };

  // "Create a new plan" on demand, from the row at the bottom.
  const [createVisible, setCreateVisible] = useState(false);

  const openCreate = () => {
    if (sheet.active || phaseRef.current !== 'idle') return;
    setCreateVisible(true);
  };

  // "Intensity by": a setting, saved right away. It never makes the plan
  // out of date, so leaving afterwards doesn't offer a plan update.
  const [intensityVisible, setIntensityVisible] = useState(false);

  const openIntensity = () => {
    if (sheet.active) return;
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

      <IntensitySheet
        visible={intensityVisible}
        onChoosePace={choosePace}
        onDismiss={() => setIntensityVisible(false)}
        reduceMotion={reduceMotion}
      />

      <BottomSheet
        visible={syncVisible}
        // Tapping outside stays on the screen.
        onDismiss={() => setSyncVisible(false)}
        onClosed={flushAfterClose}
        dragAnywhere
        reduceMotion={reduceMotion}
      >
        <View style={styles.syncHeader}>
          <Text style={[typography.title2, styles.syncTitle]}>
            Update your plan with these changes?
          </Text>
          <Text style={[typography.subheadline, styles.syncBody]}>
            {lengthChanged
              ? 'You changed your plan length. A new plan starts fresh this week, one week or four weeks ahead. '
              : ''}
            Create a new plan rebuilds every planned workout from today on.
            Workouts you edited will be replaced. Finished and skipped
            workouts stay.
          </Text>
        </View>
        <Button
          label="Create a new plan"
          variant="accent"
          onPress={startBuild}
        />
        <Button
          label="Keep current plan"
          variant="secondary"
          onPress={handleKeepPlan}
          style={styles.keepButton}
        />
      </BottomSheet>

      <BottomSheet
        visible={createVisible}
        onDismiss={() => setCreateVisible(false)}
        onClosed={flushAfterClose}
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
          onPress={startBuild}
        />
        <Button
          label="Cancel"
          variant="secondary"
          onPress={() => setCreateVisible(false)}
          style={styles.keepButton}
        />
      </BottomSheet>

      {(phase === 'building' || phase === 'error') && (
        <PlanBuildingView
          state={phase}
          reduceMotion={reduceMotion}
          onRetry={retryBuild}
          onCancel={cancelBuild}
        />
      )}
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
});
