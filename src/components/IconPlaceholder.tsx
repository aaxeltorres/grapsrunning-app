import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

/**
 * Generic placeholder for an icon asset.
 * Swap this out for a real icon set (e.g. lucide-react-native, expo/vector-icons)
 * once final iconography is ready — kept as a plain View per the "no images" scope.
 */
type Props = {
  size?: number;
  backgroundColor?: string;
  shape?: 'circle' | 'square';
  style?: ViewStyle;
};

export default function IconPlaceholder({
  size = 24,
  backgroundColor = 'rgba(0,0,0,0.08)',
  shape = 'circle',
  style,
}: Props) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          backgroundColor,
          borderRadius: shape === 'circle' ? size / 2 : size * 0.25,
        },
        styles.base,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
