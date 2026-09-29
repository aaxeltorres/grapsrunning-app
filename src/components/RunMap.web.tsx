import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';
import type { RouteCoordinate } from '../navigation/types';

type Props = {
  coordinates: RouteCoordinate[];
};

export default function RunMap({ coordinates }: Props) {
  return (
    <View style={[styles.container, coordinates.length === 0 && styles.emptyContainer]}>
      <Text style={styles.label}>
        {coordinates.length === 0 ? 'No route recorded' : 'Map preview unavailable on web'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 260,
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