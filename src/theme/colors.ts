/**
 * Graps Running — Color Tokens
 * Derived from visual inspection of the provided reference mockups.
 */

export const colors = {
  // Brand
  primaryBlue: '#ADE2FF', // hero gradient / brand blue
  primaryBlueLight: '#99DFFF',
  iosBlue: '#007AFF', // native iOS-feel action blue

  // Core neutrals
  black: '#000000',
  white: '#FFFFFF',

  // Home dashboard feature cards
  cardCoachBg: '#E3F2FD', // soft blue — AI Coach Mike
  cardRoutesBg: '#F3E5F5', // soft purple — Routes
  cardPlanBg: '#FFF3E0', // soft orange/peach — Plan
  cardStatsBg: '#E8F5E9', // soft mint — Stats

  // Stats dashboard accents
  statBlueStart: '#4FA8FF',
  statBlueEnd: '#0080FF',
  statOrange: '#FF8A3D',
  statOrangeBg: '#FFE8D6',
  statPurple: '#9B6BE0',
  statPurpleBg: '#EFE3FB',
  statGreen: '#2ECC71',
  statGreenBg: '#DDF5E4',

  // Neutrals / UI chrome
  background: '#FFFFFF',
  surfaceGray: '#F2F3F5', // "Daily Goal" container
  progressTrack: '#E1E4E8',
  textPrimary: '#000000',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  divider: '#E5E7EB',
  success: '#2ECC71',

  // Active Run
  runDarkBg: '#0B0B0C',
  runDarkText: '#FFFFFF',
  runDarkTextSecondary: '#9CA3AF',
} as const;

export type ColorToken = keyof typeof colors;
