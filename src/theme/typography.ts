/**
 * Graps Running — Typography Tokens
 * Uses the iOS system font (San Francisco) via `undefined` fontFamily,
 * which lets React Native resolve the native platform font automatically.
 */

import { TextStyle } from 'react-native';

const fontFamily = undefined; // resolves to San Francisco on iOS

export const typography = {
  largeTitle: {
    fontFamily,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  } as TextStyle,
  title1: {
    fontFamily,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
  } as TextStyle,
  title2: {
    fontFamily,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  } as TextStyle,
  headline: {
    fontFamily,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
  } as TextStyle,
  body: {
    fontFamily,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
  } as TextStyle,
  subheadline: {
    fontFamily,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
  } as TextStyle,
  caption: {
    fontFamily,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  } as TextStyle,
  metricBig: {
    fontFamily,
    fontSize: 40,
    fontWeight: '800',
    lineHeight: 46,
  } as TextStyle,
  metricSmall: {
    fontFamily,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 27,
  } as TextStyle,
} as const;

export type TypographyToken = keyof typeof typography;
