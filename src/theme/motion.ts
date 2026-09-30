/**
 * Graps Running — Motion Tokens
 */

import { Easing } from 'react-native';

export const motion = {
  /** Smooth Apple-style curve used for timing animations across the app. */
  easeStandard: Easing.bezier(0.4, 0.0, 0.2, 1),
  /** Quick, slightly bouncy spring for elements that pop into place. */
  springPop: { damping: 20, stiffness: 280, mass: 1 },
} as const;
