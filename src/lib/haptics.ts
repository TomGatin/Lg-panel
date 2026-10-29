// Vibration API: Android browsers only, silently ignored elsewhere (iOS Safari has no support).
function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern)
}

export const haptics = {
  /** The server accepted an action. */
  tick: () => vibrate(25),
  /** The server refused an action. */
  error: () => vibrate([60, 60, 60]),
  /** Debate time is over. */
  timeUp: () => vibrate([200, 120, 200, 120, 200])
}
