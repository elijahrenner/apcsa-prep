/** 0..1 mastery score used by dashboard and topic selection. */
export function mastery(elo: number, ema_accuracy: number, nSeen = 0): number {
  if (nSeen <= 0) return 0;
  const normElo = Math.min(1, Math.max(0, (elo - 800) / 800));
  const evidence = Math.min(1, nSeen / 8);
  return (0.6 * normElo + 0.4 * ema_accuracy) * evidence;
}

/** Princeton Review-style AP CSA scaled-score band (1-5) from a percentage. */
export function pctToFiveBand(pct: number): number {
  if (pct >= 0.72) return 5;
  if (pct >= 0.58) return 4;
  if (pct >= 0.42) return 3;
  if (pct >= 0.28) return 2;
  return 1;
}
