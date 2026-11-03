import { loginAttempts, type AttemptGuard } from './lockout';
import { verifyPassword } from './password';
import { regimeLoginConfigured, SESSION_TTL_SECONDS, signSession } from './session';

export type LoginResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'rejected' | 'locked' };

export async function evaluateLogin(input: {
  password: string;
  hash: string | undefined;
  secret: string | undefined;
  ip: string;
  nowSec: number;
  guard?: AttemptGuard;
}): Promise<LoginResult> {
  const guard = input.guard ?? loginAttempts;
  const key = input.ip || 'unknown';
  if (!regimeLoginConfigured(input.hash, input.secret)) {
    return { ok: false, reason: 'rejected' };
  }
  if (guard.status(key).locked) {
    return { ok: false, reason: 'locked' };
  }
  const password = input.password.length > 256 ? '' : input.password;
  const match = await verifyPassword(password, input.hash);
  if (!match) {
    const after = guard.recordFailure(key);
    return { ok: false, reason: after.locked ? 'locked' : 'rejected' };
  }
  guard.recordSuccess(key);
  const token = await signSession(input.secret as string, input.nowSec + SESSION_TTL_SECONDS);
  return { ok: true, token };
}
