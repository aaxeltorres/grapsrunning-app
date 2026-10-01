import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ZONE_INFO, ZONES, zonePaces } from '../coach/zones';
import { colors, radius, spacing, typography } from '../theme';
import BottomSheet from './BottomSheet';
import Button from './Button';
import { formatPace } from './WorkoutCard';

type Props = {
  visible: boolean;
  /** The runner's easy pace (seconds per km): zones are built from it. */
  easyPace: number;
  onDismiss: () => void;
  reduceMotion?: boolean;
};

/**
 * The five training zones: how each one feels and the runner's own pace
 * range for it. Zones are by pace only for now (no heart rate yet).
 */
export default function ZoneGuideSheet({
  visible,
  easyPace,
  onDismiss,
  reduceMotion,
}: Props) {
  const paces = zonePaces(easyPace);
  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} reduceMotion={reduceMotion}>
      <View style={styles.header}>
        <Text style={[typography.title2, styles.title]}>Training zones</Text>
        <Text style={[typography.subheadline, styles.secondary]}>
          Your zones are set by pace for now. Heart rate is coming soon.
        </Text>
      </View>

      <View style={styles.list}>
        {ZONES.map((zone) => (
          <View
            key={zone}
            style={styles.row}
            accessible
            accessibilityLabel={`Zone ${zone}, ${ZONE_INFO[zone].name}. ${
              ZONE_INFO[zone].feel
            } ${formatPace(paces[zone])} per kilometer`}
          >
            <View style={styles.badge}>
              <Text style={[typography.headline, styles.badgeText]}>{`Z${zone}`}</Text>
            </View>
            <View style={styles.text}>
              <Text style={[typography.headline, styles.title]}>{ZONE_INFO[zone].name}</Text>
              <Text style={[typography.subheadline, styles.secondary]}>
                {ZONE_INFO[zone].feel}
              </Text>
            </View>
            <Text style={[typography.subheadline, styles.pace]}>
              {`${formatPace(paces[zone])} /km`}
            </Text>
          </View>
        ))}
      </View>

      <Button label="Got it" variant="secondary" onPress={onDismiss} />
    </BottomSheet>
  );
}

const BADGE_SIZE = 40;

const styles = StyleSheet.create({
  header: {
    gap: spacing.xxs,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.textPrimary,
  },
  secondary: {
    color: colors.textSecondary,
  },
  list: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceGray,
  },
  badgeText: {
    color: colors.textPrimary,
  },
  text: {
    flex: 1,
  },
  pace: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
