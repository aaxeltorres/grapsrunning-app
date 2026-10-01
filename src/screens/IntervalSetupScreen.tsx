import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { rulesFor } from '../coach/generatePlan';
import { createEmptyProfile, type IntensityById } from '../coach/runnerProfile';
import {
  INTERVAL_PRESETS,
  buildIntervalWorkout,
  defaultSetup,
  newBlock,
  setupStats,
  validateSetup,
  type IntervalBlock,
  type IntervalIssue,
  type IntervalPart,
  type IntervalSetup,
} from '../run/intervalSetup';
import { MAX_BLOCKS, MAX_TOTAL_REPS, MAX_TOTAL_S } from '../run/intervalConfig';
import { RUN_MODES } from '../run/runModes';
import { intervalStorage } from '../storage/intervalStorage';
import { profileStorage } from '../storage/profileStorage';
import { todayISO } from '../utils/dates';
import { lightImpact } from '../utils/haptics';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors, radius, spacing, typography } from '../theme';
import TopBar from '../components/TopBar';
import Button from '../components/Button';
import AnswerRow from '../components/AnswerRow';
import Chip from '../components/Chip';
import IntensitySheet, { INTENSITY_LABELS } from '../components/IntensitySheet';
import IntervalBlockCard, { ValueRow } from '../components/IntervalBlockCard';
import IntervalPickerSheet, {
  type IntervalPickerKind,
} from '../components/IntervalPickerSheet';
import ZoneGuideSheet from '../components/ZoneGuideSheet';
import { formatKm, formatMinutes } from '../components/WorkoutCard';

type Props = NativeStackScreenProps<RootStackParamList, 'IntervalSetup'>;

/** What the wheel sheet is editing: a field, of a block when it has one. */
type Editing = { kind: IntervalPickerKind; blockId?: string };

function issueText(issue: IntervalIssue): string {
  switch (issue.kind) {
    case 'tooManyReps':
      return `That is ${issue.count} reps. The most is ${MAX_TOTAL_REPS} in one workout.`;
    case 'tooLong':
      return `That would take about ${formatMinutes(issue.seconds)}, over the ${formatMinutes(MAX_TOTAL_S)} limit.`;
  }
}

/**
 * Intervals setup: warm-up, up to four blocks of reps and sets (with their
 * zones and rests) and a cool-down. The setup becomes a normal workout and
 * runs like one from the plan, but it is a free run: the Plan is not
 * touched. The last setup used is remembered.
 */
export default function IntervalSetupScreen({ navigation }: Props) {
  const reduceMotion = useReduceMotion();
  const [setup, setSetup] = useState<IntervalSetup>(defaultSetup);
  const [easyPace, setEasyPace] = useState(() => rulesFor(createEmptyProfile()).easyPace);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [guideVisible, setGuideVisible] = useState(false);
  const [intensityVisible, setIntensityVisible] = useState(false);
  const [intensityBy, setIntensityBy] = useState<IntensityById>('pace');
  // The saved setup must not overwrite what the runner already changed.
  const touched = useRef(false);

  useEffect(() => {
    let active = true;
    intervalStorage
      .get()
      .catch(() => null)
      .then((saved) => {
        if (active && saved && !touched.current) setSetup(saved);
      });
    profileStorage
      .get()
      .then((profile) => {
        if (!active) return;
        setEasyPace(rulesFor(profile).easyPace);
        setIntensityBy(profile.intensityBy ?? 'pace');
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const update = (change: (current: IntervalSetup) => IntervalSetup) => {
    touched.current = true;
    setSetup(change);
  };
  const updateBlock = (block: IntervalBlock) =>
    update((current) => ({
      ...current,
      blocks: current.blocks.map((b) => (b.id === block.id ? block : b)),
    }));
  const updatePart = (key: 'warmup' | 'cooldown', patch: Partial<IntervalPart>) =>
    update((current) => ({ ...current, [key]: { ...current[key], ...patch } }));

  const workout = useMemo(
    () =>
      buildIntervalWorkout(setup, easyPace, { id: 'intervals-preview', date: todayISO() }),
    [setup, easyPace],
  );
  const stats = setupStats(setup, workout);
  const issues = validateSetup(setup, stats);

  const handleStart = async () => {
    lightImpact();
    try {
      await intervalStorage.save(setup);
    } catch (error) {
      console.warn('Failed to save the intervals setup', error);
    }
    const run = buildIntervalWorkout(setup, easyPace, {
      id: `intervals-${Date.now()}`,
      date: todayISO(),
    });
    navigation.replace('ActiveRun', { mode: 'intervals', workout: run });
  };

  // The current value of what is being edited.
  const editedBlock = setup.blocks.find((b) => b.id === editing?.blockId);
  const picker = (() => {
    if (!editing) return { value: 0, manual: false };
    switch (editing.kind) {
      case 'warmup':
        return { value: setup.warmup.minutes, manual: false };
      case 'cooldown':
        return { value: setup.cooldown.minutes, manual: false };
      default:
        break;
    }
    if (!editedBlock) return { value: 0, manual: false };
    switch (editing.kind) {
      case 'workDistance':
        return { value: editedBlock.work.meters, manual: false };
      case 'workTime':
        return { value: editedBlock.work.seconds, manual: false };
      case 'reps':
        return { value: editedBlock.reps, manual: false };
      case 'sets':
        return { value: editedBlock.sets, manual: false };
      case 'rest':
        return { value: editedBlock.rest.seconds, manual: editedBlock.rest.manual };
      default:
        return { value: editedBlock.setRest.seconds, manual: editedBlock.setRest.manual };
    }
  })();

  const handleSet = (kind: IntervalPickerKind, value: number, manual: boolean) => {
    setEditing(null);
    if (kind === 'warmup' || kind === 'cooldown') {
      updatePart(kind, { minutes: value });
      return;
    }
    if (!editedBlock) return;
    switch (kind) {
      case 'workDistance':
        updateBlock({ ...editedBlock, work: { ...editedBlock.work, meters: value } });
        break;
      case 'workTime':
        updateBlock({ ...editedBlock, work: { ...editedBlock.work, seconds: value } });
        break;
      case 'reps':
        updateBlock({ ...editedBlock, reps: value });
        break;
      case 'sets':
        updateBlock({ ...editedBlock, sets: value });
        break;
      case 'rest':
        updateBlock({ ...editedBlock, rest: { ...editedBlock.rest, seconds: value, manual } });
        break;
      case 'setRest':
        updateBlock({
          ...editedBlock,
          setRest: { ...editedBlock.setRest, seconds: value, manual },
        });
        break;
    }
  };

  const summary =
    stats.meters === null
      ? `≈ ${formatMinutes(stats.seconds)}`
      : `≈ ${formatMinutes(stats.seconds)} · ≈ ${formatKm(stats.meters)}`;

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
      <TopBar title={RUN_MODES.intervals.name} onBack={() => navigation.goBack()} right={null} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[typography.body, styles.secondary]}>
          Build your reps and sets, then run them step by step.
        </Text>

        <View style={styles.group}>
          <Text style={[typography.subheadline, styles.label]}>Quick presets</Text>
          <View style={styles.chips}>
            {INTERVAL_PRESETS.map((preset) => (
              <Chip
                key={preset.id}
                label={preset.label}
                onPress={() => {
                  touched.current = true;
                  setSetup(preset.build());
                }}
              />
            ))}
          </View>
        </View>

        <View style={styles.zoneGroup}>
          <View style={styles.list}>
            <AnswerRow
              label="Intensity by"
              value={INTENSITY_LABELS[intensityBy]}
              onPress={() => {
                lightImpact();
                setIntensityVisible(true);
              }}
            />
          </View>
          <Pressable
            style={styles.guideLink}
            accessibilityRole="button"
            accessibilityLabel="Open the zone guide"
            hitSlop={8}
            onPress={() => {
              lightImpact();
              setGuideVisible(true);
            }}
          >
            <Text style={[typography.subheadline, styles.link]}>Zone guide</Text>
          </Pressable>
        </View>

        <PartCard
          title="Warm-up"
          part={setup.warmup}
          onToggle={(on) => updatePart('warmup', { on })}
          onPick={() => setEditing({ kind: 'warmup' })}
        />

        {setup.blocks.map((block, index) => (
          <IntervalBlockCard
            key={block.id}
            block={block}
            index={index}
            canRemove={setup.blocks.length > 1}
            easyPace={easyPace}
            onChange={updateBlock}
            onRemove={() =>
              update((current) => ({
                ...current,
                blocks: current.blocks.filter((b) => b.id !== block.id),
              }))
            }
            onPick={(kind) => setEditing({ kind, blockId: block.id })}
            reduceMotion={reduceMotion}
          />
        ))}

        <Button
          label="Add block"
          variant="secondary"
          disabled={setup.blocks.length >= MAX_BLOCKS}
          onPress={() => update((current) => ({ ...current, blocks: [...current.blocks, newBlock()] }))}
        />

        <PartCard
          title="Cool-down"
          part={setup.cooldown}
          onToggle={(on) => updatePart('cooldown', { on })}
          onPick={() => setEditing({ kind: 'cooldown' })}
        />
      </ScrollView>

      <View style={styles.footer}>
        <Text
          accessibilityLiveRegion="polite"
          style={[typography.headline, styles.summary]}
        >
          {summary}
        </Text>
        {issues.length > 0 && (
          <View style={styles.issues} accessibilityLiveRegion="polite">
            {issues.map((issue) => (
              <Text key={issue.kind} style={[typography.subheadline, styles.issueText]}>
                {issueText(issue)}
              </Text>
            ))}
          </View>
        )}
        <Button
          label="Start intervals"
          variant="accent"
          disabled={issues.length > 0}
          onPress={handleStart}
        />
      </View>

      <IntervalPickerSheet
        kind={editing?.kind ?? null}
        value={picker.value}
        manual={picker.manual}
        onSet={handleSet}
        onDismiss={() => setEditing(null)}
        reduceMotion={reduceMotion}
      />
      <IntensitySheet
        visible={intensityVisible}
        onChoosePace={() => {
          lightImpact();
          setIntensityVisible(false);
        }}
        onDismiss={() => setIntensityVisible(false)}
        reduceMotion={reduceMotion}
      />
      <ZoneGuideSheet
        visible={guideVisible}
        easyPace={easyPace}
        onDismiss={() => setGuideVisible(false)}
        reduceMotion={reduceMotion}
      />
    </SafeAreaView>
  );
}

/** Warm-up and cool-down: a switch, and its length when it is on. */
function PartCard({
  title,
  part,
  onToggle,
  onPick,
}: {
  title: string;
  part: IntervalPart;
  onToggle: (on: boolean) => void;
  onPick: () => void;
}) {
  return (
    <View style={styles.partCard}>
      <View style={styles.partHeader}>
        <Text style={[typography.headline, styles.title]}>{title}</Text>
        <Switch
          accessibilityLabel={title}
          value={part.on}
          onValueChange={(on) => {
            lightImpact();
            onToggle(on);
          }}
          trackColor={{ true: colors.iosBlue }}
          thumbColor={colors.white}
        />
      </View>
      {part.on && (
        <ValueRow label="Length, easy pace (Z1)" value={`${part.minutes} min`} onPress={onPick} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Only the cards scroll. `minHeight: 0` lets it shrink below its content
  // on web, so the footer below is never pushed off or drawn over.
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  secondary: {
    color: colors.textSecondary,
  },
  title: {
    color: colors.textPrimary,
  },
  label: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  group: {
    gap: spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  zoneGroup: {
    gap: spacing.xs,
  },
  list: {
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
  },
  guideLink: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.xxs,
  },
  link: {
    color: colors.iosBlue,
    fontWeight: '600',
  },
  partCard: {
    gap: spacing.xs,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.background,
  },
  partHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summary: {
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  issues: {
    gap: spacing.xs,
  },
  issueText: {
    color: colors.alertRedLight,
  },
  // The summary, any message and Start stay in view on any screen height.
  footer: {
    flexShrink: 0,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
});
