/**
 * Shared types for Coach Mike's scripted conversations.
 */

import type { RunnerAnswers, RunnerProfile } from './runnerProfile';

/** Who wrote a chat message. */
export type ChatSender = 'mike' | 'user';

export type ChoiceOption<Id extends string = string> = {
  /** Stable id stored in the runner profile. */
  id: Id;
  label: string;
};

/** Mike's copy. Pass several strings for light variants; one is picked per answer. */
export type MikeCopy = string | [string, ...string[]];

/** Display unit for a number question. Values are always stored in this unit. */
export type UnitConfig = {
  id: 'years' | 'cm' | 'kg';
  label: string;
};

/** Reaction picked by how many options were selected (inclusive range). */
export type CountReaction = {
  min: number;
  max: number;
  text: string;
};

/** Any value an answer sheet can produce. */
export type AnswerValue = string | string[] | number;

type FieldsOfType<T> = {
  [K in keyof RunnerAnswers]: RunnerAnswers[K] extends T ? K : never;
}[keyof RunnerAnswers];

type ChoiceField = FieldsOfType<string>;
type MultiChoiceField = FieldsOfType<string[]>;
type NumberField = FieldsOfType<number>;

type ChoiceId<F extends ChoiceField> = Extract<RunnerAnswers[F], string>;
type MultiChoiceId<F extends MultiChoiceField> = Extract<
  RunnerAnswers[F] extends (infer E)[] ? E : never,
  string
>;

type QuestionBase = {
  /** Mike's question. */
  text: string;
  /** Title shown at the top of the answer sheet. */
  sheetTitle: string;
  /** Short row label in the recap card, e.g. "Goal". */
  recapLabel: string;
  /** Mike's reaction when no specific one applies. */
  defaultReaction: MikeCopy;
  /** Ask only when this returns true for the answers so far. */
  askIf?: (profile: RunnerProfile) => boolean;
};

type ChoiceQuestionFor<F extends ChoiceField> = QuestionBase & {
  type: 'choice';
  id: F;
  input: 'wheel' | 'cards';
  options: ChoiceOption<ChoiceId<F>>[];
  reactions?: Partial<Record<ChoiceId<F>, string>>;
};

type MultiChoiceQuestionFor<F extends MultiChoiceField> = QuestionBase & {
  type: 'multiChoice';
  id: F;
  input: 'days' | 'multiselect';
  options: ChoiceOption<MultiChoiceId<F>>[];
  /** Selecting this option clears the others, and vice versa. */
  exclusiveOptionId?: MultiChoiceId<F>;
  /** Used when exactly one option is selected. */
  reactions?: Partial<Record<MultiChoiceId<F>, string>>;
  /** Used by selection count when no single-option reaction applies. */
  countReactions?: CountReaction[];
};

type NumberQuestionFor<F extends NumberField> = QuestionBase & {
  type: 'number';
  id: F;
  input: 'wheel';
  min: number;
  max: number;
  step?: number;
  /** Wheel position when the question has no answer yet. */
  defaultValue: number;
  unit: UnitConfig;
};

/** Pick one option (goal, level...). */
export type ChoiceQuestion = {
  [F in ChoiceField]: ChoiceQuestionFor<F>;
}[ChoiceField];

/** Pick one or more options (days, injuries...). */
export type MultiChoiceQuestion = {
  [F in MultiChoiceField]: MultiChoiceQuestionFor<F>;
}[MultiChoiceField];

/** Pick a number on a wheel (age, height, weight). */
export type NumberQuestion = {
  [F in NumberField]: NumberQuestionFor<F>;
}[NumberField];

export type QuestionStep = ChoiceQuestion | MultiChoiceQuestion | NumberQuestion;

/** Mike says something, preceded by the typing indicator. */
export type MessageStep = {
  type: 'message';
  /** Unique within the script. */
  id: string;
  text: string;
  /** Fixed typing indicator duration; by default it follows the length. */
  typingMs?: number;
};

/**
 * Card summarizing every answer, with a confirm button. The conversation
 * pauses here until the user confirms.
 */
export type RecapStep = {
  type: 'recap';
  /** Unique within the script. */
  id: string;
  title: string;
  confirmLabel: string;
};

/** One step of a scripted conversation. */
export type ChatScriptStep = MessageStep | RecapStep | QuestionStep;
