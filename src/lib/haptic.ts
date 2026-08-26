/**
 * Haptic feedback via the Vibration API.
 * No-ops silently on iOS/desktop — safe to call everywhere.
 */
export const haptic = {
  light: () => navigator.vibrate?.(10),
  medium: () => navigator.vibrate?.(20),
  heavy: () => navigator.vibrate?.(40),
  success: () => navigator.vibrate?.([10, 50, 20]),
  error: () => navigator.vibrate?.([40, 50, 40]),
} as const;
