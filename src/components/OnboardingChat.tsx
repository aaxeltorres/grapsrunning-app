import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  buildTranscript,
  getAnswer,
  isQuestionStep,
  isSameAnswer,
  resumeRevealCount,
  withAnswer,
  type TranscriptItem,
} from '../coach/conversation';
import type { QuestionId, RunnerProfile } from '../coach/runnerProfile';
import type {
  AnswerValue,
  ChatScriptStep,
  ChatSender,
  QuestionStep,
} from '../coach/types';
import { useChatReveal, type ChatDisplayItem } from '../hooks/useChatReveal';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { profileStorage } from '../storage/profileStorage';
import { lightImpact } from '../utils/haptics';
import { motion, spacing } from '../theme';
import AnswerBubble from './AnswerBubble';
import AnswerSheet from './AnswerSheet';
import ChatBubble from './ChatBubble';
import MikeAvatar from './MikeAvatar';
import RecapCard from './RecapCard';
import TypingIndicator from './TypingIndicator';

const AVATAR_FADE_MS = 150;
// Time to read Mike's last message before `onComplete`.
const COMPLETE_HOLD_MS = 1400;

type Props = {
  /** Script to play. Must be a stable reference, e.g. a module constant. */
  script: ChatScriptStep[];
  /** Answers saved so far; earlier messages render instantly. */
  initialProfile: RunnerProfile;
  /** The user confirmed the recap card, with the final answers. */
  onConfirm?: (profile: RunnerProfile) => void;
  /** Called once the whole script has played and Mike has finished. */
  onComplete?: () => void;
};

type SheetState = {
  questionId: QuestionId | null;
  visible: boolean;
  /** Visible or still animating out. */
  active: boolean;
  /** Bumped on every open so the sheet starts from a fresh draft. */
  openCount: number;
};

type MessageGroup = {
  sender: ChatSender;
  entries: ChatDisplayItem[];
};

function senderOf(entry: ChatDisplayItem): ChatSender {
  return entry.type === 'item' && entry.item.kind === 'answer' ? 'user' : 'mike';
}

/** Consecutive entries from the same sender share one group (and avatar). */
function groupEntries(entries: ChatDisplayItem[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const entry of entries) {
    const sender = senderOf(entry);
    const last = groups[groups.length - 1];
    if (last && last.sender === sender) {
      last.entries.push(entry);
    } else {
      groups.push({ sender, entries: [entry] });
    }
  }
  return groups;
}

function entryKey(entry: ChatDisplayItem) {
  return entry.type === 'typing' ? `typing:${entry.id}` : entry.item.id;
}

function noop() {}

/**
 * Coach Mike's scripted chat. Mike asks, the user answers through bottom
 * sheets, Mike reacts, and a recap card closes the conversation. Every
 * answer is saved right away; answers can be edited by tapping them (or
 * their recap row) until the user confirms the recap.
 */
export default function OnboardingChat({
  script,
  initialProfile,
  onConfirm,
  onComplete,
}: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const scrollRef = useRef<ScrollView>(null);

  // `profile` drives the transcript. `savedProfileRef` is the latest saved
  // version: it runs ahead of `profile` while the sheet animates out.
  const [profile, setProfile] = useState(initialProfile);
  const savedProfileRef = useRef(initialProfile);
  const [recapConfirmed, setRecapConfirmed] = useState(false);
  const recapConfirmedRef = useRef(false);

  const transcript = useMemo(
    () => buildTranscript(script, profile, { recapConfirmed }),
    [script, profile, recapConfirmed],
  );
  const [initialRevealCount] = useState(() =>
    resumeRevealCount(transcript.items),
  );

  const { displayItems, isIdle } = useChatReveal(transcript.items, {
    initialRevealCount,
    onReveal: (item: TranscriptItem) => {
      if (item.kind !== 'answer') lightImpact();
    },
  });

  const questions = useMemo(() => {
    const map = new Map<QuestionId, QuestionStep>();
    script.filter(isQuestionStep).forEach((q) => map.set(q.id, q));
    return map;
  }, [script]);

  const [sheet, setSheet] = useState<SheetState>({
    questionId: null,
    visible: false,
    active: false,
    openCount: 0,
  });
  // Saved answer that is shown once the sheet has finished closing, so the
  // answer bubble pops in view rather than behind the backdrop.
  const pendingProfileRef = useRef<RunnerProfile | null>(null);

  const flushPendingAnswer = useCallback(() => {
    const pending = pendingProfileRef.current;
    pendingProfileRef.current = null;
    if (!pending) return;
    setProfile(pending);
    lightImpact();
  }, []);

  const openSheet = useCallback(
    (questionId: QuestionId) => {
      if (recapConfirmedRef.current) return;
      // Reopening while the previous sheet is still closing.
      flushPendingAnswer();
      setSheet((current) =>
        current.visible
          ? current
          : {
              questionId,
              visible: true,
              active: true,
              openCount: current.openCount + 1,
            },
      );
    },
    [flushPendingAnswer],
  );

  // Stable handlers per question, so memoized answer bubbles skip renders.
  const answerPressHandlers = useMemo(() => {
    const handlers = new Map<QuestionId, () => void>();
    questions.forEach((_, id) => handlers.set(id, () => openSheet(id)));
    return handlers;
  }, [questions, openSheet]);

  const handleConfirm = (value: AnswerValue) => {
    const question = sheet.questionId && questions.get(sheet.questionId);
    if (!sheet.visible || !question) return;

    const saved = savedProfileRef.current;
    if (!isSameAnswer(getAnswer(question, saved), value)) {
      const next = withAnswer(script, saved, question, value);
      savedProfileRef.current = next;
      pendingProfileRef.current = next;
      // Saved before the sheet animates out, so leaving the screen right
      // away can't lose the answer.
      profileStorage
        .save(next)
        .catch((error) => console.warn('Failed to save runner profile', error));
    }
    setSheet((current) => ({ ...current, visible: false }));
  };

  const handleDismiss = () =>
    setSheet((current) => ({ ...current, visible: false }));

  const handleSheetClosed = () => {
    flushPendingAnswer();
    setSheet((current) =>
      current.visible ? current : { ...current, active: false },
    );
  };

  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;
  const handleRecapConfirm = useCallback(() => {
    if (recapConfirmedRef.current) return;
    recapConfirmedRef.current = true;
    setRecapConfirmed(true);
    lightImpact();
    onConfirmRef.current?.(savedProfileRef.current);
  }, []);
  // Not while Mike is still typing or a sheet is open or closing.
  const canConfirmRecap = isIdle && !sheet.active;

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  useEffect(() => {
    if (!transcript.isComplete || !isIdle) return;
    const timer = setTimeout(
      () => onCompleteRef.current?.(),
      COMPLETE_HOLD_MS,
    );
    return () => clearTimeout(timer);
  }, [transcript.isComplete, isIdle]);

  // Follow the conversation when something new appears at the bottom.
  // Edits further up don't move the scroll position.
  const tail = displayItems[displayItems.length - 1];
  const tailKey = tail ? entryKey(tail) : null;
  const hasScrolledRef = useRef(false);
  useEffect(() => {
    if (!tailKey) return;
    const animated = hasScrolledRef.current && !reduceMotion;
    hasScrolledRef.current = true;
    const frame = requestAnimationFrame(() =>
      scrollRef.current?.scrollToEnd({ animated }),
    );
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tailKey]);

  const groups = groupEntries(displayItems);
  const sheetQuestion = sheet.questionId
    ? questions.get(sheet.questionId) ?? null
    : null;

  return (
    <>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {groups.map((group, index) => (
          // Groups are only appended or edited in place, so the index is
          // a stable key and avatars stay mounted.
          <ChatGroup
            key={index}
            group={group}
            reduceMotion={reduceMotion}
            questions={questions}
            answerPressHandlers={answerPressHandlers}
            onRecapRowPress={openSheet}
            onRecapConfirm={handleRecapConfirm}
            canConfirmRecap={canConfirmRecap}
          />
        ))}
      </ScrollView>

      <AnswerSheet
        question={sheetQuestion}
        initialValue={
          sheetQuestion
            ? getAnswer(sheetQuestion, savedProfileRef.current)
            : undefined
        }
        visible={sheet.visible}
        contentKey={sheet.openCount}
        onConfirm={handleConfirm}
        onDismiss={handleDismiss}
        onClosed={handleSheetClosed}
        reduceMotion={reduceMotion}
      />
    </>
  );
}

function ChatGroup({
  group,
  reduceMotion,
  questions,
  answerPressHandlers,
  onRecapRowPress,
  onRecapConfirm,
  canConfirmRecap,
}: {
  group: MessageGroup;
  reduceMotion: boolean;
  questions: Map<QuestionId, QuestionStep>;
  answerPressHandlers: Map<QuestionId, () => void>;
  onRecapRowPress: (id: QuestionId) => void;
  onRecapConfirm: () => void;
  canConfirmRecap: boolean;
}) {
  const isMike = group.sender === 'mike';
  const first = group.entries[0];
  const lastIndex = group.entries.length - 1;

  return (
    <View style={styles.group}>
      {isMike && (
        <FadingAvatar animate={first.type === 'typing' || first.animate} />
      )}
      <View style={styles.bubbles}>
        {group.entries.map((entry, index) => {
          const isFirst = index === 0;
          const isLast = index === lastIndex;

          if (entry.type === 'typing') {
            return (
              <TypingIndicator
                key={entryKey(entry)}
                isFirstInGroup={isFirst}
                reduceMotion={reduceMotion}
              />
            );
          }

          const { item } = entry;
          if (item.kind === 'answer') {
            return (
              <AnswerBubble
                key={item.id}
                text={item.text}
                questionLabel={questions.get(item.questionId)?.sheetTitle ?? ''}
                onPress={answerPressHandlers.get(item.questionId) ?? noop}
                animateOnMount={entry.animate}
                reduceMotion={reduceMotion}
              />
            );
          }

          if (item.kind === 'recap') {
            return (
              <RecapCard
                key={item.id}
                title={item.title}
                rows={item.rows}
                confirmLabel={item.confirmLabel}
                confirmed={item.confirmed}
                canConfirm={canConfirmRecap}
                onRowPress={onRecapRowPress}
                onConfirm={onRecapConfirm}
                animateOnMount={entry.animate}
                reduceMotion={reduceMotion}
              />
            );
          }

          return (
            <ChatBubble
              key={item.id}
              text={item.text}
              sender="mike"
              isFirstInGroup={isFirst}
              isLastInGroup={isLast}
              animateOnMount={entry.animate}
              reduceMotion={reduceMotion}
            />
          );
        })}
      </View>
    </View>
  );
}

/** Mike's avatar, faded in with the first bubble of his group. */
function FadingAvatar({ animate }: { animate: boolean }) {
  const opacity = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) return;
    const fade = Animated.timing(opacity, {
      toValue: 1,
      duration: AVATAR_FADE_MS,
      easing: motion.easeStandard,
      useNativeDriver: true,
    });
    fade.start();
    return () => fade.stop();
    // Fades in once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
