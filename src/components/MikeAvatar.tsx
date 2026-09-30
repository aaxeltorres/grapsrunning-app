import React from 'react';
import { ViewStyle } from 'react-native';
import { colors } from '../theme';
import IconPlaceholder from './IconPlaceholder';

type Props = {
  size?: number;
  style?: ViewStyle;
};

/**
 * Coach Mike's avatar. The single place to swap in the real artwork.
 * For now a circle in the brand blue from the entry (Splash) screen.
 */
export default function MikeAvatar({ size = 30, style }: Props) {
  return (
    <IconPlaceholder
      size={size}
      backgroundColor={colors.primaryBlue}
      style={style}
    />
  );
}
