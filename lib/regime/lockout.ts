export interface AttemptStatus {
  locked: boolean;
  retryAt: number;
}

export interface AttemptGuard {
  status(key: string): AttemptStatus;
  recordFailure(key: string): AttemptStatus;
  recordSuccess(key: string): void;
}

/**
 * Per-IP failure window. In-memory, so each server instance counts on its own.
 * Five failures inside the window lock that IP. A correct password during the
 * lock is still rejected.
 */
export function createAttemptGuard(opts: {
  maxFailures: number;
  windowMs: number;
  lockMs: number;
  now?: () => number;
}): AttemptGuard {
  const now = opts.now ?? Date.now;
  const buckets = new Map<string, { failures: number[]; lockedUntil: number }>();

  function read(key: string): AttemptStatus {
    const bucket = buckets.get(key);
    const t = now();
    if (!bucket || bucket.lockedUntil <= t) return { locked: false, retryAt: 0 };
    return { locked: true, retryAt: bucket.lockedUntil };
  }

  return {
    status: read,
    recordFailure(key: string) {
      const t = now();
      const bucket = buckets.get(key) ?? { failures: [], lockedUntil: 0 };
      if (bucket.lockedUntil > t) return { locked: true, retryAt: bucket.lockedUntil };
      bucket.failures = bucket.failures.filter((stamp) => t - stamp < opts.windowMs);
      bucket.failures.push(t);
      if (bucket.failures.length >= opts.maxFailures) {
        bucket.lockedUntil = t + opts.lockMs;
        bucket.failures = [];
      }
      buckets.set(key, bucket);
      return bucket.lockedUntil > t
        ? { locked: true, retryAt: bucket.lockedUntil }
        : { locked: false, retryAt: 0 };
    },
    recordSuccess(key: string) {
      buckets.delete(key);
    },
  };
}

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;

export const loginAttempts = createAttemptGuard({
  maxFailures: LOGIN_MAX_FAILURES,
  windowMs: LOGIN_WINDOW_MS,
  lockMs: LOGIN_LOCK_MS,
});
