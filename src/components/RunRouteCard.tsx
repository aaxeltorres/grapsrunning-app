import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RouteCoordinate } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import { hasUsableRoute } from '../run/savedRun';
import RunMap from './RunMap';

type Props = {
  coordinates: RouteCoordinate[];
  /** Title of the empty state; defaults to "No route recorded". */
  emptyTitle?: string;
  /** Line under the empty title. */
  emptyText?: string;
};

const MAP_HEIGHT = 320;
const EMPTY_HEIGHT = 200;
const PIN_SIZE = 36;

/**
 * The route of a finished run: the map in a rounded card, or a calm
 * placeholder when there is no route (one point isn't a route).
 */
export default function RunRouteCard({
  coordinates,
  emptyTitle = 'No route recorded',
  emptyText = "Location wasn't available for this run.",
}: Props) {
  if (hasUsableRoute(coordinates)) {
    return <RunMap coordinates={coordinates} height={MAP_HEIGHT} />;
  }

  return (
    <View
      style={styles.empty}
      accessible
      accessibilityLabel={`${emptyTitle}. ${emptyText}`}
    >
      <View style={styles.pin}>
        <View style={styles.pinDot} />
      </View>
      <Text style={[typography.headline, styles.emptyTitle]}>{emptyTitle}</Text>
      <Text style={[typography.subheadline, styles.emptyText]}>{emptyText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    height: EMPTY_HEIGHT,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceGray,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.lg,
  },
  pin: {
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: PIN_SIZE / 2,
    borderWidth: 3,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  pinDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.textMuted,
  },
  emptyTitle: {
    color: colors.textPrimary,
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
