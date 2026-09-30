export * from './colors';
export * from './typography';
export * from './spacing';
export * from './motion';

import { colors } from './colors';
import { typography } from './typography';
import { spacing, radius } from './spacing';
import { motion } from './motion';

export const theme = {
  colors,
  typography,
  spacing,
  radius,
  motion,
} as const;

export type Theme = typeof theme;
