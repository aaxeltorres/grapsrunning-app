import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';
import type { RouteCoordinate } from '../navigation/types';

const DEFAULT_HEIGHT = 260;

type Props = {
  coordinates: RouteCoordinate[];
  /** Card height; defaults to 260. */
  height?: number;
};

export default function RunMap({ coordinates, height = DEFAULT_HEIGHT }: Props) {
  return (
    <View
      style={[
        styles.container,
        { height },
        coordinates.length === 0 && styles.emptyContainer,
      ]}
    >
      <Text style={styles.label}>
        {coordinates.length === 0 ? 'No route recorded' : 'Map preview unavailable on web'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: DEFAULT_HEIGHT,
    borderRadius: radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceGray,
  },
  emptyContainer: {
    backgroundColor: colors.background,
  },
  label: {
    color: colors.textSecondary,
  },
});