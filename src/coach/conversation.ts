/**
 * Pure conversation logic for Mike's scripted chats (no React).
 *
 * The transcript is derived from the script plus the saved answers, so a
 * resumed or edited conversation is always rebuilt exactly, and messages
 * can never be duplicated.
 */

import {
  withDerivedFields,
  type QuestionId,
  type RunnerProfile,
} from './runnerProfile';
import type {
  AnswerValue,
  ChatScriptStep,
  ChoiceOption,
  MikeCopy,
  QuestionStep,
} from './types';

const ANSWER_SEPARATOR = ' · ';

export type RecapRow = {
  questionId: QuestionId;
  label: string;
  value: string;
};

export type TranscriptItem =
  | {
      kind: 'mike';
      id: string;
      text: string;
      /** Fixed typing indicator duration, when the script sets one. */
      typingMs?: number;
    }
  | {
      kind: 'answer';
      id: string;
      questionId: QuestionId;
      /** `null` while the question is waiting for an answer. */
      text: string | null;
    }
  | {
      kind: 'recap';
      id: string;
      title: string;
      confirmLabel: string;
      rows: RecapRow[];
      confirmed: boolean;
    };

export type Transcript = {
  items: TranscriptItem[];
  /** The whole script has played: every question answered, recap confirmed. */
  isComplete: boolean;
};

export type TranscriptOptions = {
  /** The user confirmed the recap card. */
  recapConfirmed?: boolean;
};

export function isQuestionStep(step: ChatScriptStep): step is QuestionStep {
  return step.type !== 'message' && step.type !== 'recap';
}

export function isAsked(question: QuestionStep, profile: RunnerProfile) {
  return question.askIf ? question.askIf(profile) : true;
}

/**
 * The saved answer for a question, or `undefined` when missing or no
 * longer valid (e.g. an option id was removed from the script).
 */
export function getAnswer(
  question: QuestionStep,
  profile: RunnerProfile,
): AnswerValue | undefined {
  const value: unknown = profile[question.id];

  switch (question.type) {
    case 'choice': {
      const options: ChoiceOption[] = question.options;
      return typeof value === 'string' && options.some((o) => o.id === value)
        ? value
        : undefined;
    }
    case 'multiChoice': {
      if (!Array.isArray(value)) return undefined;
      const selected = normalizeSelection(question.options, value);
      return selected.length > 0 ? selected : undefined;
    }
    case 'number':
      return typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= question.min &&
        value <= question.max
        ? value
        : undefined;
  }
}

/** Keeps known option ids only, in script order. */
export function normalizeSelection(
  options: ChoiceOption[],
  selected: unknown[],
): string[] {
  return options.filter((o) => selected.includes(o.id)).map((o) => o.id);
}

/** Text of the user's answer bubble, e.g. "Mon · Wed · Sat". */
export function formatAnswer(question: QuestionStep, value: AnswerValue) {
  switch (question.type) {
    case 'choice': {
      const options: ChoiceOption[] = question.options;
      return options.find((o) => o.id === value)?.label ?? String(value);
    }
    case 'multiChoice': {
      const options: ChoiceOption[] = question.options;
      const selected = Array.isArray(value) ? value : [value];
      return options
        .filter((o) => selected.includes(o.id))
        .map((o) => o.label)
        .join(ANSWER_SEPARATOR);
    }
    case 'number':
      return `${value} ${question.unit.label}`;
  }
}

/**
 * Mike's reaction to an answer. `key` changes whenever the text does, so
 * an edited answer gets a freshly typed reaction.
 */
export function reactionFor(
  question: QuestionStep,
  value: AnswerValue,
): { key: string; text: string } {
  if (question.type === 'choice' && typeof value === 'string') {
    const reactions: Partial<Record<string, string>> = question.reactions ?? {};
    const text = reactions[value];
    if (text) return { key: `option-${value}`, text };
  }

  if (question.type === 'multiChoice' && Array.isArray(value)) {
    const reactions: Partial<Record<string, string>> = question.reactions ?? {};
    const single = value.length === 1 ? reactions[value[0]] : undefined;
    if (single) return { key: `option-${value[0]}`, text: single };

    const byCount = question.countReactions?.find(
      (r) => value.length >= r.min && value.length <= r.max,
    );
    if (byCount) {
      return { key: `count-${byCount.min}-${byCount.max}`, text: byCount.text };
    }
  }

  return pickVariant(question.defaultReaction, String(value));
}

/** Stable pick: the same answer always gets the same variant. */
function pickVariant(copy: MikeCopy, seed: string) {
  const variants = typeof copy === 'string' ? [copy] : copy;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const index = hash % variants.length;
  return { key: `default-${index}`, text: variants[index] };
}

/** Every answer given so far, in script order, for the recap card. */
export function recapRows(
  script: ChatScriptStep[],
  profile: RunnerProfile,
): RecapRow[] {
  const rows: RecapRow[] = [];
  for (const step of script) {
    if (!isQuestionStep(step) || !isAsked(step, profile)) continue;
    const answer = getAnswer(step, profile);
    if (answer === undefined) continue;
    rows.push({
      questionId: step.id,
      label: step.recapLabel,
      value: formatAnswer(step, answer),
    });
  }
  return rows;
}

/**
 * Builds the conversation up to the first unanswered question (which ends
 * with a pending answer bubble) or the unconfirmed recap card.
 */
export function buildTranscript(
  script: ChatScriptStep[],
  profile: RunnerProfile,
  { recapConfirmed = false }: TranscriptOptions = {},
): Transcript {
  const items: TranscriptItem[] = [];

  for (const step of script) {
    if (step.type === 'message') {
      items.push({
        kind: 'mike',
        id: step.id,
        text: step.text,
        typingMs: step.typingMs,
      });
      continue;
    }
    if (step.type === 'recap') {
      items.push({
        kind: 'recap',
        id: step.id,
        title: step.title,
        confirmLabel: step.confirmLabel,
        rows: recapRows(script, profile),
        confirmed: recapConfirmed,
      });
      if (!recapConfirmed) return { items, isComplete: false };
      continue;
    }
    if (!isAsked(step, profile)) continue;

    const answer = getAnswer(step, profile);
    items.push({ kind: 'mike', id: `${step.id}:question`, text: step.text });
    items.push({
      kind: 'answer',
      id: `${step.id}:answer`,
      questionId: step.id,
      text: answer === undefined ? null : formatAnswer(step, answer),
    });

    if (answer === undefined) return { items, isComplete: false };

    const reaction = reactionFor(step, answer);
    items.push({
      kind: 'mike',
      id: `${step.id}:reaction:${reaction.key}`,
      text: reaction.text,
    });
  }

  return { items, isComplete: true };
}

/**
 * How many items to show instantly when resuming: everything up to the
 * reaction to the last answered question. The rest plays live.
 */
export function resumeRevealCount(items: TranscriptItem[]): number {
  let count = 0;
  items.forEach((item, index) => {
    if (item.kind === 'answer' && item.text !== null) count = index + 2;
  });
  return Math.min(count, items.length);
}

export function isSameAnswer(
  a: AnswerValue | undefined,
  b: AnswerValue | undefined,
) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Returns the profile with the answer applied, dropping answers to
 * questions that no longer apply (e.g. the injury follow-up after
 * switching to "No injuries").
 */
export function withAnswer(
  script: ChatScriptStep[],
  profile: RunnerProfile,
  question: QuestionStep,
  value: AnswerValue,
): RunnerProfile {
  // The answer sheet produces the value type matching the question type.
  const next = { ...profile, [question.id]: value } as RunnerProfile;

  for (const step of script) {
    if (isQuestionStep(step) && !isAsked(step, next)) {
      delete next[step.id];
    }
  }

  return withDerivedFields(next);
}
