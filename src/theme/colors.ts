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
  runDarkTrack: '#2C2C2E', // empty part of a progress bar on the dark run screen

  // Goal runs: off-track red, readable on each theme
  alertRedLight: '#D70015', // on white (paused)
  alertRedDark: '#FF453A', // on runDarkBg (running)

  // Coach Mike chat
  chatBubbleIncoming: '#E9E9EB', // iMessage-style gray for Mike's bubbles
  chatTypingDot: '#8E8E93',
  iosGreen: '#34C759', // iOS system green: selected answer tiles

  // Plan: workout types (calendar dots, legend)
  workoutEasy: '#2ECC71', // same green as the Stats accents
  workoutIntervals: '#FF8A3D', // same orange as the Stats accents
  workoutLong: '#0080FF', // same blue as the Stats accents
  workoutAerobic: '#5AC8FA', // same cyan as segmentRecovery
  workoutTempo: '#9B6BE0', // same purple as the Stats accents
  workoutSpeed: '#D70015', // same red as alertRedLight
  // Plan: workout card on the Plan peach (cardPlanBg)
  planCardAccent: '#C2410C', // deep orange text on peach
  planSegmentMuted: '#FFD7B0', // warm-up / cool-down part of the segment bar
  planSelectedDayBg: '#E3F2FD', // selected (not today) day, soft Coach blue
  segmentRecovery: '#5AC8FA', // recovery jogs and walks on the workout run screen, calm on dark and light
  // Training zones Z1-Z5 (run screen chips and timeline), easy to hard
  zone1: '#5AC8FA', // same cyan as segmentRecovery
  zone2: '#2ECC71', // same green as workoutEasy
  zone3: '#9B6BE0', // same purple as workoutTempo
  zone4: '#FF8A3D', // same orange as workoutIntervals
  zone5: '#FF453A', // same red as alertRedDark, readable on both themes

  // Bottom sheets
  sheetBackdrop: 'rgba(0,0,0,0.4)',
  sheetGrabber: '#D1D1D6',
} as const;

export type ColorToken = keyof typeof colors;
