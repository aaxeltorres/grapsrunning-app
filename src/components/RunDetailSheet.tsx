import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { hasUsableRoute, runTagLabel } from '../run/savedRun';
import type { SavedRun } from '../run/types';
import { colors, radius, spacing, typography } from '../theme';
import { formatRunSheetDate } from '../utils/dates';
import {
  formatClock,
  formatPaceSeconds,
  formatSpokenDuration,
  PACE_PLACEHOLDER,
} from '../utils/format';
import BottomSheet from './BottomSheet';
import MetricCard from './MetricCard';
import PlanComparisonSection from './PlanComparisonSection';
import RunRouteCard from './RunRouteCard';
import RunSplits from './RunSplits';

const SHEET_MAX_HEIGHT_SHARE = 0.8;
/** The map is created after the sheet has slid in, so creating it can't stall the slide. */
const MAP_MOUNT_DELAY_MS = 350;
const MAP_PLACEHOLDER_HEIGHT = 320;

type Props = {
  /** The run to show. Keep it set until the exit animation ends (`onClosed`). */
  run: SavedRun | null;
  visible: boolean;
  onDismiss: () => void;
  onClosed: () => void;
  /** Asks to delete the run; the host confirms and closes the sheet. */
  onDelete: (run: SavedRun) => void;
  reduceMotion?: boolean;
};

/**
 * The details of a saved run in a bottom sheet: route, main numbers,
 * splits and, for a plan run, planned vs actual. The map only exists while
 * the sheet is open (the sheet's Modal unmounts its content when closed).
 */
export default function RunDetailSheet({
  run,
  visible,
  onDismiss,
  onClosed,
  onDelete,
  reduceMotion,
}: Props) {
  const { height: windowHeight } = useWindowDimensions();

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      onClosed={onClosed}
      reduceMotion={reduceMotion}
    >
      {run && (
        <ScrollView
          style={{ maxHeight: windowHeight * SHEET_MAX_HEIGHT_SHARE }}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Header run={run} onClose={onDismiss} />

          <RouteSection route={run.route} reduceMotion={reduceMotion} />

          <View style={styles.metrics}>
            <MetricCard
              value={(run.distanceMeters / 1000).toFixed(2)}
              unit="km"
              accessibilityLabel={`Distance, ${(run.distanceMeters / 1000).toFixed(2)} kilometers`}
              accentColor={colors.statGreen}
              backgroundColor={colors.statGreenBg}
            />
            <MetricCard
              value={formatClock(run.movingDurationSec)}
              unit="time"
              accessibilityLabel={`Moving time, ${formatSpokenDuration(run.movingDurationSec)}`}
              accentColor={colors.statPurple}
              backgroundColor={colors.statPurpleBg}
            />
            <MetricCard
              value={formatPaceSeconds(run.avgPaceSecPerKm)}
              unit="min/km"
              accessibilityLabel={
                formatPaceSeconds(run.avgPaceSecPerKm) === PACE_PLACEHOLDER
                  ? 'Average pace, not available'
                  : `Average pace, ${formatPaceSeconds(run.avgPaceSecPerKm)} per kilometer`
              }
              accentColor={colors.statOrange}
              backgroundColor={colors.statOrangeBg}
            />
          </View>

          <RunSplits splits={run.splits} />

          {run.planned && (
            <PlanComparisonSection
              title={run.planned.title}
              planned={{
                distanceMeters: run.planned.plannedDistanceMeters,
                durationSeconds: run.planned.plannedDurationSeconds,
              }}
              distanceKm={run.distanceMeters / 1000}
              durationSeconds={run.movingDurationSec}
              partial={run.planned.partial}
            />
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete run"
            accessibilityHint="Asks for confirmation before removing this run from your history"
            onPress={() => onDelete(run)}
            style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
          >
            <Text style={[typography.headline, styles.deleteText]}>Delete run</Text>
          </Pressable>
        </ScrollView>
      )}
    </BottomSheet>
  );
}

/**
 * The route map. It mounts inside the sheet's Modal, so it only exists while
 * the sheet is open, and a placeholder holds its place until the sheet has
 * slid in. A route that isn't worth a map shows the empty card at once.
 */
function RouteSection({
  route,
  reduceMotion,
}: {
  route: SavedRun['route'];
  reduceMotion?: boolean;
}) {
  const usable = hasUsableRoute(route);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!usable) return;
    const timer = setTimeout(() => setMapReady(true), reduceMotion ? 0 : MAP_MOUNT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [usable, reduceMotion]);

  if (!usable) {
    return (
      <RunRouteCard
        coordinates={route}
        emptyTitle="No route available"
        emptyText="This run has no GPS route to show."
      />
    );
  }
  if (!mapReady) {
    return <View style={styles.mapPlaceholder} accessibilityElementsHidden />;
  }
  return (
    <View accessible accessibilityLabel="Route map">
      <RunRouteCard coordinates={route} />
    </View>
  );
}

function Header({ run, onClose }: { run: SavedRun; onClose: () => void }) {
  const tag = runTagLabel(run);
  const subtitle = [tag, run.calories !== undefined ? `${run.calories} kcal` : undefined]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={[typography.title2, styles.title]} accessibilityRole="header">
          {formatRunSheetDate(Date.parse(run.startedAt))}
        </Text>
        {subtitle.length > 0 && (
          <Text style={[typography.subheadline, styles.subtitle]}>{subtitle}</Text>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Done"
        hitSlop={12}
        onPress={onClose}
        style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
      >
        <Text style={[typography.headline, styles.close]}>Done</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headerText: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    color: colors.textPrimary,
  },
  subtitle: {
    color: colors.textSecondary,
  },
  close: {
    color: colors.iosBlue,
  },
  closeButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  mapPlaceholder: {
    height: MAP_PLACEHOLDER_HEIGHT,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceGray,
  },
  pressed: {
    opacity: 0.6,
  },
  metrics: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  delete: {
    minHeight: 48,
    borderRadius: radius.button,
    backgroundColor: colors.surfaceGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: colors.alertRedLight,
  },
});
