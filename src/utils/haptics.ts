import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Haptics are a nice-to-have: ignore failures on unsupported platforms (web).

/** Light tap, e.g. when a chat message arrives. */
export function lightImpact(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Firmer tap, e.g. when a workout moves to its next segment. */
export function mediumImpact(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** A work step (rep) starts: a firm, distinct thump. */
export function workStartHaptic(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}

/** A rest starts: soft, so it feels different from a rep. */
export function restStartHaptic(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
}

/** One beat of the 3, 2, 1 before a timed rep. */
export function countdownHaptic(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Light tick as a wheel picker moves to another row (iOS only). */
export function selectionTick(): void {
  if (Platform.OS !== 'ios') return;
  Haptics.selectionAsync().catch(() => {});
}

/** Success confirmation, e.g. after a dev reset. */
export function successNotification(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => {},
  );
}
