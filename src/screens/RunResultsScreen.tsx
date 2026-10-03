import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import TopBar from '../components/TopBar';
import RunRouteCard from '../components/RunRouteCard';
import RunSplits from '../components/RunSplits';
import GoalResultsSection from '../components/GoalResultsSection';
import PlanComparisonSection from '../components/PlanComparisonSection';
import RepResultsSection from '../components/RepResultsSection';
import Button from '../components/Button';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useStaggeredEntrance } from '../hooks/useStaggeredEntrance';
import { displayName, totalDistance, totalDuration } from '../coach/plan';
import { isRunSaveable, MIN_DISTANCE_METERS, MIN_DURATION_SEC } from '../run/runValidity';
import { formatRunDateTime } from '../utils/dates';
import { formatClock, formatPace } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'RunResults'>;

const COUNT_UP_MS = 450;

type Section = { key: string; node: React.ReactNode };

export default function RunResultsScreen({ route, navigation }: Props) {
  const {
    distanceKm,
    durationSeconds,
    route: routeCoordinates,
    goal,
    startedAt,
    calories,
    splits = [],
    planned,
    reps,
  } = route.params;
  const reduceMotion = useReduceMotion();
  // A run that is not long enough is not saved: only a notice is shown.
  const tooShort = !isRunSaveable(distanceKm * 1000, durationSeconds);

  // Counts the hero distance up on entry; Reduce Motion shows it at once.
  const [displayDistance, setDisplayDistance] = useState(0);
  useEffect(() => {
    if (reduceMotion || tooShort) {
      setDisplayDistance(distanceKm);
      return;
    }
    const start = Date.now();
    let frame: number;
    const tick = () => {
      const progress = Math.min((Date.now() - start) / COUNT_UP_MS, 1);
      setDisplayDistance(distanceKm * (1 - (1 - progress) * (1 - progress)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [distanceKm, reduceMotion, tooShort]);

  // Sections stack in this order. A new one (e.g. planned vs actual) is one
  // more entry here; the header and the layout around it don't change.
  const sections: Section[] = [
    {
      key: 'hero',
      node: tooShort ? (
        <ShortRun
          distanceKm={distanceKm}
          durationSeconds={durationSeconds}
          onBack={() => navigation.popToTop()}
        />
      ) : (
        <Hero distanceKm={distanceKm} displayDistance={displayDistance} />
      ),
    },
  ];
  if (!tooShort) {
    sections.push({
      key: 'stats',
      node: (
        <Stats
          time={formatClock(durationSeconds)}
          pace={formatPace(durationSeconds, distanceKm)}
          calories={calories}
        />
      ),
    });
  }
  if (!tooShort) {
    sections.push({
      key: 'route',
      node: <RunRouteCard coordinates={routeCoordinates} />,
    });
  }
  if (goal && !tooShort) {
    sections.push({
      key: 'goals',
      node: (
        <GoalResultsSection
          goal={goal}
          distanceKm={distanceKm}
          durationSeconds={durationSeconds}
        />
      ),
    });
  }
  if (planned && !tooShort) {
    sections.push({
      key: 'planned',
      node: (
        <PlanComparisonSection
          title={displayName(planned.workout)}
          planned={{
            distanceMeters: totalDistance(planned.workout),
            durationSeconds: totalDuration(planned.workout),
          }}
          partial={planned.partial}
          distanceKm={distanceKm}
          durationSeconds={durationSeconds}
        />
      ),
    });
  }
  // The reps of a structured workout (plan or intervals), right under
  // planned vs actual when there is one.
  if (reps && reps.length > 0 && !tooShort) {
    sections.push({ key: 'reps', node: <RepResultsSection reps={reps} /> });
  }
  if (!tooShort && splits.some((split) => !split.partial)) {
    sections.push({ key: 'splits', node: <RunSplits splits={splits} /> });
  }

  const entrance = useStaggeredEntrance(sections.length, reduceMotion);

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
      <TopBar
        title={tooShort ? 'Run ended' : 'Run complete'}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done"
            hitSlop={12}
            onPress={() => navigation.popToTop()}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={[typography.headline, styles.done]}>Done</Text>
          </Pressable>
        }
      />
      {startedAt !== undefined && (
        <Text style={[typography.subheadline, styles.subtitle]}>
          {formatRunDateTime(startedAt)}
        </Text>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {sections.map((section, i) => (
          <Animated.View key={section.key} style={entrance[i]}>
            {section.node}
          </Animated.View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Total distance, the number the screen leads with. */
function Hero({
  distanceKm,
  displayDistance,
}: {
  distanceKm: number;
  displayDistance: number;
}) {
  return (
    <View
      style={styles.hero}
      accessible
      accessibilityLabel={`${distanceKm.toFixed(2)} kilometers`}
    >
      <Text
        style={[typography.metricHero, styles.heroValue]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {displayDistance.toFixed(2)}
      </Text>
      <Text style={[typography.title2, styles.heroUnit]}>km</Text>
    </View>
  );
}

/** Time, average pace and calories in one quiet card. */
function Stats({
  time,
  pace,
  calories,
}: {
  time: string;
  pace: string;
  calories?: number;
}) {
  const cells = [
    { label: 'Time', value: time },
    { label: 'Avg pace /km', value: pace },
    ...(calories !== undefined
      ? [{ label: 'Calories', value: String(calories) }]
      : []),
  ];
  return (
    <View style={styles.stats}>
      {cells.map((cell, i) => (
        <React.Fragment key={cell.label}>
          {i > 0 && <View style={styles.statDivider} />}
          <View
            style={styles.stat}
            accessible
            accessibilityLabel={`${cell.label}: ${cell.value}`}
          >
            <Text
              style={[typography.title1, styles.statValue]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {cell.value}
            </Text>
            <Text style={[typography.caption, styles.statLabel]}>{cell.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

/** Shown instead of the whole summary when the run was too short to be saved. */
function ShortRun({
  distanceKm,
  durationSeconds,
  onBack,
}: {
  distanceKm: number;
  durationSeconds: number;
  onBack: () => void;
}) {
  const details = [
    Number.isFinite(distanceKm) && distanceKm > 0
      ? `${Math.round(distanceKm * 1000)} m`
      : null,
    Number.isFinite(durationSeconds) && durationSeconds > 0
      ? formatClock(durationSeconds)
      : null,
  ].filter(Boolean);
  return (
    <View style={styles.shortRun}>
      <Text style={[typography.largeTitle, styles.shortTitle]}>Run too short to be saved</Text>
      <Text style={[typography.body, styles.shortText]}>
        Runs need at least {MIN_DISTANCE_METERS / 1000} km and {MIN_DURATION_SEC / 60} minutes of
        moving time to be saved.
      </Text>
      {details.length > 0 && (
        <Text style={[typography.subheadline, styles.shortDetails]}>
          {details.join(' · ')}
        </Text>
      )}
      <Button
        label="Back to Home"
        onPress={onBack}
        style={styles.shortButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  done: {
    color: colors.iosBlue,
  },
  pressed: {
    opacity: 0.6,
  },
  subtitle: {
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    marginTop: -spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  heroValue: {
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  heroUnit: {
    color: colors.textSecondary,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceGray,
    paddingVertical: spacing.lg,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
  },
  statValue: {
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: colors.textSecondary,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.divider,
  },
  shortRun: {
    gap: spacing.xs,
    paddingTop: spacing.md,
  },
  shortTitle: {
    color: colors.textPrimary,
  },
  shortText: {
    color: colors.textSecondary,
  },
  shortButton: {
    marginTop: spacing.lg,
  },
  shortDetails: {
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
});
