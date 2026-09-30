import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import TypingIndicator from './TypingIndicator';

const AVATAR_FADE_MS = 150;

type Props = {
  /** Script to play. Must be a stable reference, e.g. a module constant. */
  script: ChatScriptStep[];
  /** Answers saved so far; earlier messages render instantly. */
  initialProfile: RunnerProfile;
  /** Called once every question is answered and Mike has finished. */
  onComplete?: () => void;
};

type SheetState = {
  questionId: QuestionId | null;
  visible: boolean;
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

/**
 * Coach Mike's scripted chat. Mike asks, the user answers through bottom
 * sheets, Mike reacts. Every answer is saved right away; answers can be
 * edited by tapping them.
 */
export default function OnboardingChat({
  script,
  initialProfile,
  onComplete,
}: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const scrollRef = useRef<ScrollView>(null);

  const [profile, setProfile] = useState(initialProfile);
  const transcript = useMemo(
    () => buildTranscript(script, profile),
    [script, profile],
  );
  const [initialRevealCount] = useState(() =>
    resumeRevealCount(transcript.items),
  );

  const { displayItems, isIdle } = useChatReveal(transcript.items, {
    initialRevealCount,
    onReveal: (item: TranscriptItem) => {
      if (item.kind === 'mike') lightImpact();
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
    openCount: 0,
  });
  // Applied once the sheet has finished closing, so the answer bubble
  // pops in view rather than behind the backdrop.
  const pendingAnswerRef = useRef<{
    question: QuestionStep;
    value: AnswerValue;
  } | null>(null);

  const applyAnswer = (question: QuestionStep, value: AnswerValue) => {
    if (isSameAnswer(getAnswer(question, profile), value)) return;

    const next = withAnswer(script, profile, question, value);
    setProfile(next);
    lightImpact();
    profileStorage
      .save(next)
      .catch((error) => console.warn('Failed to save runner profile', error));
  };

  const flushPendingAnswer = () => {
    const pending = pendingAnswerRef.current;
    pendingAnswerRef.current = null;
    if (pending) applyAnswer(pending.question, pending.value);
  };

  const openSheet = (questionId: QuestionId) => {
    if (sheet.visible) return;
    // Reopening while the previous sheet is still closing.
    flushPendingAnswer();
    setSheet((current) =>
      current.visible
        ? current
        : { questionId, visible: true, openCount: current.openCount + 1 },
    );
  };

  const handleConfirm = (value: AnswerValue) => {
    const question = sheet.questionId && questions.get(sheet.questionId);
    if (!sheet.visible || !question) return;
    pendingAnswerRef.current = { question, value };
    setSheet((current) => ({ ...current, visible: false }));
  };

  const handleDismiss = () =>
    setSheet((current) => ({ ...current, visible: false }));

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  useEffect(() => {
    if (transcript.isComplete && isIdle) onCompleteRef.current?.();
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
            questionLabel={(id) => questions.get(id)?.sheetTitle ?? ''}
            onAnswerPress={openSheet}
          />
        ))}
      </ScrollView>

      <AnswerSheet
        question={sheetQuestion}
        initialValue={
          sheetQuestion ? getAnswer(sheetQuestion, profile) : undefined
        }
        visible={sheet.visible}
        contentKey={sheet.openCount}
        onConfirm={handleConfirm}
        onDismiss={handleDismiss}
        onClosed={flushPendingAnswer}
        reduceMotion={reduceMotion}
      />
    </>
  );
}

function ChatGroup({
  group,
  reduceMotion,
  questionLabel,
  onAnswerPress,
}: {
  group: MessageGroup;
  reduceMotion: boolean;
  questionLabel: (id: QuestionId) => string;
  onAnswerPress: (id: QuestionId) => void;
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
                questionLabel={questionLabel(item.questionId)}
                onPress={() => onAnswerPress(item.questionId)}
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
