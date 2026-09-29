import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius } from '../theme';

type Props = {
  /** 0 to 1 */
  progress: number;
  fillColor?: string;
  trackColor?: string;
  height?: number;
  style?: ViewStyle;
};

export default function ProgressBar({
  progress,
  fillColor = colors.iosBlue,
  trackColor = colors.progressTrack,
  height = 10,
  style,
}: Props) {
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <View
      style={[styles.track, { backgroundColor: trackColor, height }, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <View
        style={[
          styles.fill,
          {
            backgroundColor: fillColor,
            width: `${clamped * 100}%`,
            height,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: radius.pill,
  },
});
