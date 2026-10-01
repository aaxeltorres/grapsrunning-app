import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { IntensityById } from '../coach/runnerProfile';
import { colors, spacing, typography } from '../theme';
import BottomSheet from './BottomSheet';
import Button from './Button';
import OptionTile from './OptionTile';

export const INTENSITY_LABELS: Record<IntensityById, string> = {
  pace: 'Pace',
  heartRate: 'Heart rate',
};

type Props = {
  visible: boolean;
  /** Pace tile or Done: the caller saves it when it differs from what is stored. */
  onChoosePace: () => void;
  onDismiss: () => void;
  reduceMotion?: boolean;
};

/**
 * "Intensity by" sheet shared by Your profile and Intervals: how training
 * zones are measured. Pace is the only choice for now; Heart rate is shown
 * as coming soon and can't be selected.
 */
export default function IntensitySheet({
  visible,
  onChoosePace,
  onDismiss,
  reduceMotion,
}: Props) {
  return (
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      dragAnywhere
      reduceMotion={reduceMotion}
    >
      <View style={styles.header}>
        <Text style={[typography.title2, styles.title]}>Intensity by</Text>
        <Text style={[typography.subheadline, styles.body]}>
          How your training zones are measured.
        </Text>
      </View>
      <View style={styles.options}>
        <OptionTile label="Pace" role="radio" selected onPress={onChoosePace} />
        <OptionTile
          label="Heart rate"
          accessibilityLabel="Heart rate, coming soon. Not available yet."
          role="radio"
          selected={false}
          disabled
          onPress={() => {}}
        />
      </View>
      <Text style={[typography.subheadline, styles.comingSoon]}>
        Heart rate: coming soon. It needs a heart rate sensor, so your zones
        stay on pace for now.
      </Text>
      <Button label="Done" variant="secondary" onPress={onChoosePace} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xxs,
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.textPrimary,
  },
  body: {
    color: colors.textSecondary,
  },
  options: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  comingSoon: {
    color: colors.planCardAccent,
    marginBottom: spacing.md,
  },
});
