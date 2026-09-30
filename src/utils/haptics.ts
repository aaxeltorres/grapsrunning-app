import * as Haptics from 'expo-haptics';

// Haptics are a nice-to-have: ignore failures on unsupported platforms (web).

/** Light tap, e.g. when a chat message arrives. */
export function lightImpact(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Success confirmation, e.g. after a dev reset. */
export function successNotification(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => {},
  );
}
