/**
 * Graps Running — Motion Tokens
 */

import { Easing } from 'react-native';

export const motion = {
  /** Smooth Apple-style curve used for timing animations across the app. */
  easeStandard: Easing.bezier(0.4, 0.0, 0.2, 1),
  /** Active Run theme fade: light to dark on open and resume, back on pause. */
  durationRunTheme: 400,
  /** Screen sections fading in one after another (e.g. Run results). */
  durationEnter: 300,
  /** Quick, slightly bouncy spring for elements that pop into place. */
  springPop: { damping: 20, stiffness: 280, mass: 1 },
  /** Bouncier pop, e.g. an answer bubble filling in. */
  springBounce: { damping: 12, stiffness: 320, mass: 0.8 },
  /** Bottom sheet slide-up: fast, with almost no overshoot. */
  springSheet: { damping: 30, stiffness: 300, mass: 1 },
} as const;
