// Test retake rules (shared by the server action, the lesson page and the admin).
//
// A student has ATTEMPTS_PER_CYCLE attempts (i.e. one mistake allowed). If all of them fail,
// the test is locked for RETAKE_PAUSE_DAYS so the student can review the lesson; after the
// pause a new cycle with the same number of attempts starts. Once passed, the test is done.
// The state is derived from the attempt history, so resetting attempts in the admin unlocks it.

export const ATTEMPTS_PER_CYCLE = 2;
export const RETAKE_PAUSE_DAYS = 2;
const PAUSE_MS = RETAKE_PAUSE_DAYS * 24 * 60 * 60 * 1000;

export type AttemptLike = { passed: boolean; createdAt: Date | string };

export type TestAttemptState = {
  passed: boolean;
  /** Attempts left in the current cycle (0 while locked or after passing). */
  attemptsLeft: number;
  /** Retake allowed from this moment (ISO string); null when not locked. */
  lockedUntil: string | null;
  /** Failed attempts in the current cycle. */
  failsInCycle: number;
};

export function testAttemptState(attempts: AttemptLike[], now = new Date()): TestAttemptState {
  const sorted = [...attempts].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  let fails = 0;
  let lockEnd: number | null = null;
  for (const a of sorted) {
    const t = +new Date(a.createdAt);
    if (lockEnd !== null && t >= lockEnd) {
      fails = 0;
      lockEnd = null;
    }
    if (a.passed) return { passed: true, attemptsLeft: 0, lockedUntil: null, failsInCycle: 0 };
    fails++;
    if (fails >= ATTEMPTS_PER_CYCLE) lockEnd = t + PAUSE_MS;
  }
  if (lockEnd !== null && +now < lockEnd) {
    return { passed: false, attemptsLeft: 0, lockedUntil: new Date(lockEnd).toISOString(), failsInCycle: fails };
  }
  if (lockEnd !== null) fails = 0; // the pause is over — a new cycle starts
  return { passed: false, attemptsLeft: ATTEMPTS_PER_CYCLE - fails, lockedUntil: null, failsInCycle: fails };
}
