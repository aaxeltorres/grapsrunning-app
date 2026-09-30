import React, { useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { normalizeSelection } from '../coach/conversation';
import type {
  AnswerValue,
  ChoiceOption,
  ChoiceQuestion,
  MultiChoiceQuestion,
  NumberQuestion,
  QuestionStep,
} from '../coach/types';
import { lightImpact } from '../utils/haptics';
import { colors, spacing, typography } from '../theme';
import BottomSheet from './BottomSheet';
import Button from './Button';
import OptionTile from './OptionTile';
import WheelPicker from './WheelPicker';

const TILE_GAP = spacing.sm;
const DAY_COLUMNS = 4;
const MULTISELECT_COLUMNS = 2;
// Room kept for the grabber, header, Done button and a gap above the sheet.
// The text-sized part grows with Dynamic Type.
const SHEET_CHROME_FIXED = 120;
const SHEET_CHROME_TEXT = 140;

type Props = {
  /** Question being answered; kept while the sheet animates out. */
  question: QuestionStep | null;
  initialValue?: AnswerValue;
  visible: boolean;
  /** Change it on every open to start from a fresh draft. */
  contentKey: number;
  onConfirm: (value: AnswerValue) => void;
  onDismiss: () => void;
  onClosed: () => void;
  reduceMotion?: boolean;
};

/**
 * Bottom sheet with the right input for a question (wheel, cards, day
 * tiles or multi-select tiles) and a Done button.
 */
export default function AnswerSheet({
  question,
  initialValue,
  visible,
  contentKey,
  onConfirm,
  onDismiss,
  onClosed,
  reduceMotion,
}: Props) {
  return (
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      onClosed={onClosed}
      reduceMotion={reduceMotion}
    >
      {question && (
        <SheetContent
          key={contentKey}
          question={question}
          initialValue={initialValue}
          onConfirm={onConfirm}
        />
      )}
    </BottomSheet>
  );
}

function initialDraft(
  question: QuestionStep,
  initialValue: AnswerValue | undefined,
): AnswerValue | undefined {
  if (initialValue !== undefined) return initialValue;
  switch (question.type) {
    case 'choice':
      // A wheel always shows a value; cards start with nothing selected.
      return question.input === 'wheel' ? question.options[0]?.id : undefined;
    case 'multiChoice':
      return [];
    case 'number':
      return question.defaultValue;
  }
}

function SheetContent({
  question,
  initialValue,
  onConfirm,
}: {
  question: QuestionStep;
  initialValue?: AnswerValue;
  onConfirm: (value: AnswerValue) => void;
}) {
  const [draft, setDraft] = useState(() =>
    initialDraft(question, initialValue),
  );
  const submittedRef = useRef(false);
  const insets = useSafeAreaInsets();
  const { height: windowHeight, fontScale } = useWindowDimensions();
  // Long inputs scroll on small screens (iPhone SE) or with large text,
  // so the title and Done button always stay on screen.
  const inputMaxHeight =
    windowHeight -
    insets.top -
    insets.bottom -
    SHEET_CHROME_FIXED -
    SHEET_CHROME_TEXT * Math.max(1, fontScale);

  const canSubmit =
    draft !== undefined && (!Array.isArray(draft) || draft.length > 0);

  const handleDone = () => {
    // Ignore repeated taps while the sheet closes.
    if (!canSubmit || submittedRef.current) return;
    submittedRef.current = true;
    onConfirm(draft);
  };

  let subtitle: string | null = null;
  if (question.type === 'multiChoice') {
    const count = Array.isArray(draft) ? draft.length : 0;
    subtitle =
      question.input === 'days'
        ? count === 0
          ? 'Pick at least one day'
          : `${count} ${count === 1 ? 'day' : 'days'} selected`
        : 'Select all that apply';
  }

  return (
    <View>
      <View style={styles.header}>
        <Text style={[typography.title2, styles.title]}>
          {question.sheetTitle}
        </Text>
        {subtitle && (
          <Text style={[typography.subheadline, styles.subtitle]}>
            {subtitle}
          </Text>
        )}
      </View>

      <ScrollView
        style={[styles.input, { maxHeight: inputMaxHeight }]}
        alwaysBounceVertical={false}
        showsVerticalScrollIndicator={false}
      >
        {question.type === 'choice' && (
          <ChoiceInput
            question={question}
            value={typeof draft === 'string' ? draft : undefined}
            onChange={setDraft}
          />
        )}
        {question.type === 'multiChoice' && (
          <MultiChoiceInput
            question={question}
            value={Array.isArray(draft) ? draft : []}
            onChange={setDraft}
          />
        )}
        {question.type === 'number' && (
          <NumberInput
            question={question}
            value={typeof draft === 'number' ? draft : question.defaultValue}
            onChange={setDraft}
          />
        )}
      </ScrollView>

      <Button label="Done" onPress={handleDone} disabled={!canSubmit} />
    </View>
  );
}

function ChoiceInput({
  question,
  value,
  onChange,
}: {
  question: ChoiceQuestion;
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  const options: ChoiceOption[] = question.options;

  if (question.input === 'wheel') {
    return (
      <WheelPicker
        items={options.map((o) => ({ value: o.id, label: o.label }))}
        selectedValue={value ?? options[0]?.id ?? ''}
        onValueChange={onChange}
        accessibilityLabel={question.sheetTitle}
      />
    );
  }

  return (
    <View style={styles.list}>
      {options.map((option) => (
        <OptionTile
          key={option.id}
          role="radio"
          label={option.label}
          selected={option.id === value}
          onPress={() => {
            lightImpact();
            onChange(option.id);
          }}
        />
      ))}
    </View>
  );
}

/** Toggles an option, honoring the exclusive option (e.g. "No injuries"). */
function toggleSelection(
  selected: string[],
  optionId: string,
  exclusiveOptionId: string | undefined,
): string[] {
  if (selected.includes(optionId)) {
    return selected.filter((id) => id !== optionId);
  }
  if (optionId === exclusiveOptionId) return [optionId];
  return [...selected.filter((id) => id !== exclusiveOptionId), optionId];
}

function MultiChoiceInput({
  question,
  value,
  onChange,
}: {
  question: MultiChoiceQuestion;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const options: ChoiceOption[] = question.options;
  const isDays = question.input === 'days';
  const columns = isDays ? DAY_COLUMNS : MULTISELECT_COLUMNS;
  // Sheet content spans the window minus the sheet's side padding.
  const contentWidth = windowWidth - spacing.lg * 2;
  const tileWidth = (contentWidth - TILE_GAP * (columns - 1)) / columns;

  const handlePress = (optionId: string) => {
    lightImpact();
    const next = toggleSelection(value, optionId, question.exclusiveOptionId);
    onChange(normalizeSelection(options, next));
  };

  return (
    <View style={styles.grid}>
      {options.map((option) => (
        <OptionTile
          key={option.id}
          role="checkbox"
          variant={isDays ? 'square' : 'row'}
          label={option.label}
          selected={value.includes(option.id)}
          onPress={() => handlePress(option.id)}
          style={{
            width:
              option.id === question.exclusiveOptionId
                ? contentWidth
                : tileWidth,
          }}
        />
      ))}
    </View>
  );
}

function NumberInput({
  question,
  value,
  onChange,
}: {
  question: NumberQuestion;
  value: number;
  onChange: (value: number) => void;
}) {
  const { min, max, step = 1, unit } = question;
  const items = useMemo(
    () =>
      Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, i) => {
        const n = min + i * step;
        return { value: n, label: String(n) };
      }),
    [min, max, step],
  );

  return (
    <WheelPicker
      items={items}
      selectedValue={value}
      onValueChange={onChange}
      unitLabel={unit.label}
      accessibilityLabel={question.sheetTitle}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xxs,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.textPrimary,
  },
  subtitle: {
    color: colors.textSecondary,
  },
  input: {
    flexGrow: 0,
    marginBottom: spacing.lg,
  },
  list: {
    gap: TILE_GAP,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TILE_GAP,
  },
});
