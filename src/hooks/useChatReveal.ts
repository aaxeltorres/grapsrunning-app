import { useEffect, useRef, useState } from 'react';
import type { TranscriptItem } from '../coach/conversation';

// Lets the screen transition settle before Mike starts typing.
const INITIAL_DELAY_MS = 600;
const PAUSE_BEFORE_MESSAGE_MS = 450;
const PAUSE_BEFORE_ANSWER_MS = 350;

const TYPING_MIN_MS = 800;
const TYPING_MAX_MS = 1200;
const TYPING_MS_PER_CHAR = 4;

/** Typing indicator duration, proportional to the message length. */
export function typingDurationFor(text: string): number {
  return Math.min(
    TYPING_MAX_MS,
    TYPING_MIN_MS + text.length * TYPING_MS_PER_CHAR,
  );
}

export type ChatDisplayItem =
  | {
      type: 'item';
      item: TranscriptItem;
      /** False for history restored on mount: it renders instantly. */
      animate: boolean;
    }
  | { type: 'typing'; id: string };

type Options = {
  /** Leading items shown instantly on mount (resumed conversation). */
  initialRevealCount: number;
  /** Called as each item appears (e.g. for haptics). */
  onReveal?: (item: TranscriptItem) => void;
};

/**
 * Chat engine: reveals transcript items one at a time, in order. Mike's
 * messages get a pause and a typing indicator first; answer bubbles and
 * cards appear after a short pause.
 *
 * Items are matched by id, so when the transcript changes (an answer is
 * given or edited) only the new items play; everything else stays put.
 */
export function useChatReveal(
  items: TranscriptItem[],
  { initialRevealCount, onReveal }: Options,
) {
  const [instantIds] = useState(
    () => new Set(items.slice(0, initialRevealCount).map((item) => item.id)),
  );
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(
    () => new Set(instantIds),
  );
  const [typingId, setTypingId] = useState<string | null>(null);
  const hasStartedRef = useRef(initialRevealCount > 0);

  const onRevealRef = useRef(onReveal);
  onRevealRef.current = onReveal;

  const next = items.find((item) => !revealed.has(item.id));

  // Forget items that left the transcript (e.g. a reaction replaced by an
  // edit), so they play again if they come back.
  useEffect(() => {
    const ids = new Set(items.map((item) => item.id));
    instantIds.forEach((id) => {
      if (!ids.has(id)) instantIds.delete(id);
    });
    setRevealed((current) => {
      const kept = new Set([...current].filter((id) => ids.has(id)));
      return kept.size === current.size ? current : kept;
    });
  }, [items, instantIds]);

  useEffect(() => {
    if (!next) return;

    const item = next;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const reveal = () => {
      // Batched together, so a bubble replaces the indicator in one frame.
      setTypingId(null);
      setRevealed((current) => new Set(current).add(item.id));
      onRevealRef.current?.(item);
    };

    const pause = !hasStartedRef.current
      ? INITIAL_DELAY_MS
      : item.kind === 'answer'
        ? PAUSE_BEFORE_ANSWER_MS
        : PAUSE_BEFORE_MESSAGE_MS;
    hasStartedRef.current = true;

    timers.push(
      setTimeout(() => {
        if (item.kind !== 'mike') {
          reveal();
          return;
        }
        setTypingId(item.id);
        timers.push(
          setTimeout(reveal, item.typingMs ?? typingDurationFor(item.text)),
        );
      }, pause),
    );

    return () => {
      timers.forEach(clearTimeout);
      setTypingId(null);
    };
    // Restart only when the next item to reveal changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next?.id]);

  const displayItems: ChatDisplayItem[] = [];
  for (const item of items) {
    if (revealed.has(item.id)) {
      displayItems.push({ type: 'item', item, animate: !instantIds.has(item.id) });
    } else if (item.id === typingId) {
      displayItems.push({ type: 'typing', id: item.id });
    }
  }

  return {
    displayItems,
    /** Nothing left to reveal. */
    isIdle: next === undefined,
  };
}
