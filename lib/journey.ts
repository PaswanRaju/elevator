export type Phase = 'arrival' | 'entering' | 'boarding' | 'riding' | 'revealing' | 'reveal';
export type JourneyEvent = 'ENTER' | 'SELECT_13' | 'COMPLETE' | 'REPLAY';
export type JourneyFrame = { phase: Phase; progress: number; reduced: boolean };
export const DURATIONS = { entering: 5400, riding: 8200, revealing: 4600 } as const;
export const TOTAL_DURATION = DURATIONS.entering + DURATIONS.riding + DURATIONS.revealing;
export function transition(phase: Phase, event: JourneyEvent): Phase {
  if (phase === 'arrival' && event === 'ENTER') return 'entering';
  if (phase === 'entering' && event === 'COMPLETE') return 'boarding';
  if (phase === 'boarding' && event === 'SELECT_13') return 'riding';
  if (phase === 'riding' && event === 'COMPLETE') return 'revealing';
  if (phase === 'revealing' && event === 'COMPLETE') return 'reveal';
  if (phase === 'reveal' && event === 'REPLAY') return 'arrival';
  return phase;
}
export function duration(phase: Phase, reduced = false): number {
  if (!(phase in DURATIONS)) return 0;
  if (reduced) return phase === 'riding' ? 2400 : 1100;
  return DURATIONS[phase as keyof typeof DURATIONS];
}
export function smooth(a: number, b: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
export function sampleJourney({ phase, progress, reduced }: JourneyFrame) {
  const p = Math.max(0, Math.min(1, progress));
  const entering = phase === 'entering';
  const inside = phase === 'boarding' || phase === 'riding';
  const outside = phase === 'revealing' || phase === 'reveal';
  const entry = entering ? (reduced ? (p < .5 ? 0 : 1) : smooth(0, .78, p)) : phase === 'arrival' ? 0 : 1;
  const turn = entering ? (reduced ? (p < .5 ? 0 : 1) : smooth(.65, 1, p)) : phase === 'arrival' ? 0 : 1;
  const exit = phase === 'reveal' ? 1 : phase === 'revealing' ? (reduced ? (p < .5 ? 0 : 1) : smooth(.24, 1, p)) : 0;
  let doors = phase === 'arrival' ? 0 : 1;
  if (entering) doors = smooth(.03, .30, p);
  if (phase === 'riding') doors = 1 - smooth(0, .17, p);
  if (phase === 'revealing') doors = smooth(.03, .40, p);
  return {
    entry, turn, exit, doors,
    city: outside || (phase === 'riding' && p > .4),
    floor: phase === 'riding' ? Math.min(13, Math.floor(smooth(.20, .90, p) * 13)) : outside ? 13 : 0,
    shake: phase === 'riding' && !reduced ? Math.sin(smooth(.15, .95, p) * Math.PI) : 0,
    cabin: inside,
    reveal: outside,
    fade: reduced && (entering || phase === 'revealing') ? Math.max(0, 1 - Math.abs(p - .5) * 8) : 0,
  };
}
