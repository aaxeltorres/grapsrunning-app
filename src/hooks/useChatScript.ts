import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, ChatScriptStep } from '../coach/types';

// Lets the screen transition settle before Mike starts typing.
const INITIAL_DELAY_MS = 600;
const PAUSE_AFTER_MESSAGE_MS = 450;

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

type Options = {
  /** Called as each message lands (e.g. for haptics). */
  onMessage?: (message: ChatMessage) => void;
  /** Called once every step has played. */
  onComplete?: () => void;
};

type ChatScriptState = {
  messages: ChatMessage[];
  isTyping: boolean;
  isComplete: boolean;
};

/**
 * Chat engine: plays a scripted conversation step by step, showing the
 * typing indicator before each of Mike's messages.
 *
 * `steps` must be a stable reference (e.g. a module-level constant);
 * a new array restarts the conversation.
 */
export function useChatScript(
  steps: ChatScriptStep[],
  { onMessage, onComplete }: Options = {},
): ChatScriptState {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // Keep the latest callbacks without restarting the script.
  const onMessageRef = useRef(onMessage);
  const onCompleteRef = useRef(onComplete);
  onMessageRef.current = onMessage;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(setTimeout(resolve, ms));
      });

    setMessages([]);
    setIsTyping(false);
    setIsComplete(false);

    const play = async () => {
      await wait(INITIAL_DELAY_MS);

      for (const step of steps) {
        if (cancelled) return;

        switch (step.type) {
          case 'message': {
            setIsTyping(true);
            await wait(step.typingMs ?? typingDurationFor(step.text));
            if (cancelled) return;

            const message: ChatMessage = {
              id: step.id,
              sender: 'mike',
              text: step.text,
            };
            // Batched together, so the bubble replaces the indicator in one frame.
            setIsTyping(false);
            setMessages((current) => [...current, message]);
            onMessageRef.current?.(message);

            await wait(step.pauseAfterMs ?? PAUSE_AFTER_MESSAGE_MS);
            break;
          }
          // Question steps will be handled here once answer inputs land.
        }
      }

      if (cancelled) return;
      setIsComplete(true);
      onCompleteRef.current?.();
    };

    play();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [steps]);

  return { messages, isTyping, isComplete };
}
