export type RegimeSurface = 'regime-page' | 'regime-api';
export type RegimeDecision = 'allow' | 'deny' | 'login';

/**
 * Regime gate. No Supabase.
 * Cron bearer opens only the API refresh route.
 * A valid session or an allowlisted IP opens pages and APIs.
 * Anonymous API callers are denied (404). Anonymous pages go to the password
 * form only when the hash and session secret are both configured.
 */
export function decideRegimeAccess(input: {
  surface: RegimeSurface;
  ipAllowed: boolean;
  cronAuthorized: boolean;
  sessionValid: boolean;
  loginConfigured: boolean;
}): RegimeDecision {
  if (input.surface === 'regime-api' && input.cronAuthorized) return 'allow';
  if (input.ipAllowed) return 'allow';
  if (input.sessionValid) return 'allow';
  if (input.surface === 'regime-api') return 'deny';
  if (input.loginConfigured) return 'login';
  return 'deny';
}
