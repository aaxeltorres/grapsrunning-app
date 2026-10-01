import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Haptics are a nice-to-have: ignore failures on unsupported platforms (web).

/** Light tap, e.g. when a chat message arrives. */
export function lightImpact(): void {
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
