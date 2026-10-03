import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';
import Button from '../components/Button';
import MikeCard from '../components/MikeCard';
import RunDetailSheet from '../components/RunDetailSheet';
import RunHistoryRow from '../components/RunHistoryRow';
import TopBar from '../components/TopBar';
import { statsMikeMessage } from '../coach/statsMessage';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useStaggeredEntrance } from '../hooks/useStaggeredEntrance';
import { groupRunsByMonth, reuseRuns, type RunMonthSection } from '../run/savedRun';
import type { SavedRun } from '../run/types';
import { runHistoryStorage } from '../storage/runHistoryStorage';
import { planStorage } from '../storage/planStorage';
import { profileStorage } from '../storage/profileStorage';
import type { Plan } from '../coach/plan';
import type { RunnerProfile } from '../coach/runnerProfile';

/** What Mike's line needs besides the runs, read on every focus. */
type CoachContext = { plan: Plan | null; profile: RunnerProfile | null; now: Date };

type Props = NativeStackScreenProps<RootStackParamList, 'Stats'>;

// Dev only: sample runs to try the screen with. Metro replaces `__DEV__`
// with `false` in release bundles and drops the require, so this module
// never ships.
const devTools = __DEV__
  ? (require('../dev/sampleRuns') as typeof import('../dev/sampleRuns'))
  : null;

// An alert shown from another alert's button waits for the first to leave.
const ALERT_HANDOVER_MS = 350;

export default function StatsScreen({ navigation }: Props) {
  const reduceMotion = useReduceMotion();
  // `null` while the history loads, so the empty state never flashes.
  const [runs, setRuns] = useState<SavedRun[] | null>(null);
  const [selected, setSelected] = useState<SavedRun | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [coach, setCoach] = useState<CoachContext>(() => ({
    plan: null,
    profile: null,
    now: new Date(),
  }));
  // Only the latest load may change the list: a slow, older one must not
  // bring back a run that was deleted meanwhile.
  const loadCount = useRef(0);

  const reload = useCallback(async () => {
    const id = ++loadCount.current;
    // Mike's line also reads the plan and profile; either may be missing.
    const [loaded, plan, profile] = await Promise.all([
      runHistoryStorage.loadRuns(),
      planStorage.get().catch(() => null),
      profileStorage.get().catch(() => null),
    ]);
    if (id !== loadCount.current) return;
    setCoach({ plan, profile, now: new Date() });
    // Runs that didn't change keep their objects, so their rows don't re-render.
    setRuns((current) => reuseRuns(current, loaded));
  }, []);

  // Reloads every time the screen is focused, so a run just finished shows up.
  useFocusEffect(
    useCallback(() => {
      reload();
      return () => {
        // A load that finishes after the screen lost focus is dropped.
        loadCount.current += 1;
      };
    }, [reload]),
  );

  const handleOpen = useCallback((run: SavedRun) => {
    setSelected(run);
    setSheetVisible(true);
  }, []);

  const handleDismiss = useCallback(() => setSheetVisible(false), []);
  // The run stays set during the exit animation so the sheet doesn't blank.
  const handleClosed = useCallback(() => setSelected(null), []);

  const handleDelete = useCallback((run: SavedRun) => {
    Alert.alert(
      'Delete this run?',
      "It will be removed from your history. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await runHistoryStorage.deleteRun(run.id);
            } catch (error) {
              console.warn('Failed to delete the run', error);
              setTimeout(
                () => Alert.alert("Couldn't delete the run", 'Please try again.'),
                ALERT_HANDOVER_MS,
              );
              return;
            }
            // Any load already in flight predates the delete: drop it.
            loadCount.current += 1;
            setRuns((current) => current && current.filter((r) => r.id !== run.id));
            setSheetVisible(false);
          },
        },
      ],
    );
  }, []);

  const handleDevMenu = useCallback(() => {
    if (!devTools) return;
    Alert.alert('Run history (dev)', 'Sample runs to try this screen.', [
      {
        text: 'Add sample runs',
        onPress: async () => {
          await devTools.seedSampleRuns();
          reload();
        },
      },
      {
        text: 'Remove sample runs',
        style: 'destructive',
        onPress: async () => {
          await devTools.clearSampleRuns();
          reload();
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [reload]);

  const handleStartRun = useCallback(() => navigation.navigate('RunMode'), [navigation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <TopBar title="Stats" onTitleLongPress={devTools ? handleDevMenu : undefined} />

      {runs !== null && (
        <StatsContent
          runs={runs}
          coach={coach}
          reduceMotion={reduceMotion}
          onOpenRun={handleOpen}
          onStartRun={handleStartRun}
          onDevMenu={devTools ? handleDevMenu : undefined}
        />
      )}

      <RunDetailSheet
        run={selected}
        visible={sheetVisible}
        onDismiss={handleDismiss}
        onClosed={handleClosed}
        onDelete={handleDelete}
        reduceMotion={reduceMotion}
      />
    </SafeAreaView>
  );
}

type ContentProps = {
  runs: SavedRun[];
  coach: CoachContext;
  reduceMotion: boolean;
  onOpenRun: (run: SavedRun) => void;
  onStartRun: () => void;
  onDevMenu?: () => void;
};

/**
 * The history (or its empty state) under Mike's card; fades in once, after
 * the first load. Memoized, so opening and closing the detail sheet doesn't
 * re-render the list.
 */
const StatsContent = React.memo(function StatsContent({
  runs,
  coach,
  reduceMotion,
  onOpenRun,
  onStartRun,
  onDevMenu,
}: ContentProps) {
  const entrance = useStaggeredEntrance(2, reduceMotion);
  const message = statsMikeMessage({ runs, ...coach });
  const sections = useMemo(() => groupRunsByMonth(runs), [runs]);

  // No message, no card (and none of its spacing).
  const mikeCard = useMemo(
    () =>
      message ? (
        <Animated.View style={[styles.mike, entrance[0]]}>
          <MikeCard message={message} reduceMotion={reduceMotion} />
        </Animated.View>
      ) : null,
    // The entrance styles are stable for the life of the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [message, reduceMotion],
  );

  const renderItem = useCallback(
    ({ item }: { item: SavedRun }) => <RunHistoryRow run={item} onPress={onOpenRun} />,
    [onOpenRun],
  );
  const renderSectionHeader = useCallback(
    ({ section }: { section: RunMonthSection }) => <MonthHeader section={section} />,
    [],
  );

  if (runs.length === 0) {
    return (
      // Mike's bubble and the button, centered in the free space; the
      // screen scrolls if large text makes them taller than it.
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.emptyContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.emptyCenter}>
          {mikeCard}
          <Animated.View style={[styles.emptyAction, entrance[1]]}>
            <Button label="Start a run" onPress={onStartRun} />
          </Animated.View>
        </View>
        {__DEV__ && onDevMenu && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dev: sample runs"
            onPress={onDevMenu}
            hitSlop={8}
            style={styles.dev}
          >
            <Text style={[typography.caption, styles.devText]}>Dev: sample runs</Text>
          </Pressable>
        )}
      </ScrollView>
    );
  }

  return (
    <Animated.View style={[styles.flex, entrance[1]]}>
      <SectionList<SavedRun, RunMonthSection>
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ItemSeparatorComponent={RowSeparator}
        ListHeaderComponent={mikeCard}
        stickySectionHeadersEnabled
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </Animated.View>
  );
});

function keyExtractor(run: SavedRun) {
  return run.id;
}

function MonthHeader({ section }: { section: RunMonthSection }) {
  const count = section.data.length;
  const summary = `${count} ${count === 1 ? 'run' : 'runs'} · ${(
    section.totalMeters / 1000
  ).toFixed(1)} km`;
  return (
    <View
      style={styles.monthHeader}
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${section.title}, ${summary}`}
    >
      <Text style={[typography.headline, styles.monthTitle]}>{section.title}</Text>
      <Text
        style={[typography.subheadline, styles.monthSummary]}
        maxFontSizeMultiplier={1.3}
      >
        {summary}
      </Text>
    </View>
  );
}

function RowSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  mike: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  monthHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    backgroundColor: colors.background,
  },
  monthTitle: {
    flexShrink: 1,
    color: colors.textPrimary,
  },
  monthSummary: {
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  separator: {
    height: spacing.xs,
  },
  emptyContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  emptyCenter: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyAction: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  dev: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
  },
  devText: {
    color: colors.textMuted,
  },
});
