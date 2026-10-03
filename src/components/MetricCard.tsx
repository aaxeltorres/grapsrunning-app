import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { radius, spacing, typography } from '../theme';
import IconPlaceholder from './IconPlaceholder';

type Props = {
  value: string;
  unit: string;
  accentColor: string;
  backgroundColor: string;
  /** What a screen reader says for the whole tile (default: the value and the unit). */
  accessibilityLabel?: string;
};

/**
 * Small stat tile used in the Stats dashboard grid
 * (kcal / minutes / steps).
 */
export default function MetricCard({
  value,
  unit,
  accentColor,
  backgroundColor,
  accessibilityLabel,
}: Props) {
  return (
    <View
      style={[styles.card, { backgroundColor }]}
      accessible
      accessibilityLabel={accessibilityLabel ?? `${value} ${unit}`}
    >
      <IconPlaceholder
        size={22}
        backgroundColor={accentColor}
        style={styles.icon}
      />
      <Text
        style={[typography.metricSmall, styles.value, { color: accentColor }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={[typography.caption, { color: accentColor }]}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    gap: spacing.xxs,
  },
  icon: {
    marginBottom: spacing.xxs,
  },
  value: {
    alignSelf: 'stretch',
    textAlign: 'center',
    paddingHorizontal: spacing.xs,
    fontVariant: ['tabular-nums'],
  },
});
