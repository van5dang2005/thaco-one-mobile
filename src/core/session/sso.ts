import { fetchWithTimeout } from '@/core/api/fetchWithTimeout';
import { env } from '@/core/config/env';

import { SsoError, type SsoErrorCode } from './SsoError';
import { tokenStore, type TokenPair } from './tokenStore';

type KeycloakReply = { access_token?: string; refresh_token?: string; error?: string; error_description?: string };

/** Keycloak Account API profile (`GET {issuer}/account`). */
export type SsoAccount = { id?: string; username?: string; firstName?: string; lastName?: string; email?: string };

const transportError = (error: unknown) => new SsoError(error instanceof Error && error.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK', String(error));

const formBody = (params: Record<string, string>) =>
  Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

/** POST to an OpenID Connect endpoint of the realm (`issuer` = …/realms/<realm>). */
function post(endpoint: 'token' | 'logout', params: Record<string, string>) {
  return fetchWithTimeout(
    `${env.sso.issuer}/protocol/openid-connect/${endpoint}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: formBody({ client_id: env.sso.clientId, ...params }),
    },
    env.requestTimeoutMs,
  );
}

/** Keycloak `{ error, error_description }` → the `errors.*` key shown to the user. */
export function ssoErrorCode(reply: Pick<KeycloakReply, 'error' | 'error_description'> | null): SsoErrorCode {
  const description = reply?.error_description?.toLowerCase() ?? '';
  switch (reply?.error) {
    case 'invalid_grant':
      // "Account is not fully set up": required actions (new password, OTP…) pending on the SSO page.
      if (description.includes('not fully set up')) return 'SSO_ACCOUNT_SETUP_REQUIRED';
      // "Account disabled", or "Account temporarily disabled" after too many wrong passwords.
      if (description.includes('disabled')) return 'SSO_ACCOUNT_DISABLED';
      return 'INVALID_CREDENTIALS';
    case 'invalid_client':
    case 'unauthorized_client':
    case 'invalid_scope':
    case 'not_allowed':
      // Unknown client, "Direct access grants" off, or a scope (offline_access) the client may not use.
      return 'SSO_CLIENT_REJECTED';
    default:
      return 'SSO_FAILED';
  }
}

async function requestTokens(params: Record<string, string>): Promise<TokenPair> {
  let response: Response;
  try {
    response = await post('token', params);
  } catch (error) {
    throw transportError(error);
  }
  const reply = (await response.json().catch(() => null)) as KeycloakReply | null;
  if (!response.ok || !reply?.access_token) throw new SsoError(ssoErrorCode(reply), reply?.error_description, response.status);
  return { token: reply.access_token, refreshToken: reply.refresh_token ?? '' };
}

/** Adds `offline_access`: Keycloak then issues an offline token, whose session outlives sign-out and SSO Session Max. */
const withOfflineAccess = (scope: string) => (scope.split(/\s+/).includes('offline_access') ? scope : `${scope} offline_access`);

/**
 * Keycloak Direct Access Grant (OAuth password grant): the app's own form, no browser. Needs a public
 * client with "Direct access grants" on; accounts that must pass OTP or an external identity provider
 * cannot sign in this way. `offline` asks for an offline token (the client needs the `offline_access` scope).
 */
export async function passwordGrant(username: string, password: string, { offline = false } = {}): Promise<TokenPair> {
  if (!env.sso.clientId) throw new SsoError('SSO_NOT_CONFIGURED');
  return requestTokens({ grant_type: 'password', username, password, scope: offline ? withOfflineAccess(env.sso.scope) : env.sso.scope });
}

/** Trades a refresh token, offline or not, for a new pair. Keycloak answers `invalid_grant` (INVALID_CREDENTIALS) once it is revoked or expired. */
export function refreshGrant(refreshToken: string): Promise<TokenPair> {
  return requestTokens({ grant_type: 'refresh_token', refresh_token: refreshToken });
}

function jwtClaims<T>(jwt: string): T | null {
  const payload = jwt.split('.')[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as T;
  } catch {
    return null;
  }
}

export type RefreshTokenInfo = {
  sessionId: string | null;
  /** The Keycloak user (`sub`), the same id the Account API answers as `id`. */
  userId: string | null;
  offline: boolean;
  /** `iat` / `exp` in ms, on Keycloak's clock; `expiresAt` is null when the token carries no expiry. */
  issuedAt: number | null;
  expiresAt: number | null;
};

/**
 * Reads a Keycloak refresh token (inspected, not verified: only Keycloak checks it): the session and user it
 * belongs to, whether it is an offline token, and its lifetime.
 */
export function refreshTokenInfo(refreshToken: string): RefreshTokenInfo {
  const claims = jwtClaims<{ typ?: string; sid?: string; session_state?: string; sub?: string; iat?: number; exp?: number }>(refreshToken);
  return {
    sessionId: claims?.sid ?? claims?.session_state ?? null,
    userId: claims?.sub ?? null,
    offline: claims?.typ === 'Offline',
    issuedAt: claims?.iat ? claims.iat * 1000 : null,
    expiresAt: claims?.exp ? claims.exp * 1000 : null,
  };
}

/**
 * Confirms a new access token with the realm's Account API (`GET {issuer}/account`) and returns the
 * profile. The token needs the `account` audience, which Keycloak adds while the client keeps the
 * account roles in scope (default roles with "Full scope allowed").
 */
export async function fetchSsoAccount(token: string): Promise<SsoAccount> {
  let response: Response;
  try {
    response = await fetchWithTimeout(`${env.sso.issuer}/account`, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } }, env.requestTimeoutMs);
  } catch (error) {
    throw transportError(error);
  }
  if (response.status === 401 || response.status === 403) throw new SsoError('SSO_NOT_AUTHORIZED', `HTTP_${response.status}`);
  // JSON is the REST API; an HTML page (the account console, a proxy's login) means it was not reached.
  const account = (await response.json().catch(() => null)) as SsoAccount | null;
  if (!response.ok || !(account?.id || account?.username)) throw new SsoError('SSO_FAILED', `HTTP_${response.status}`);
  return account;
}

/**
 * - `refreshed`: a newer pair is stored; retry with it.
 * - `rejected`: Keycloak refused the refresh token (400/401: expired, revoked, account disabled…), so the session is over.
 * - `unavailable`: Keycloak was not reached or failed (network, timeout, 5xx); the session may still be fine.
 */
export type RefreshOutcome = 'refreshed' | 'rejected' | 'unavailable';

let refreshing: Promise<RefreshOutcome> | null = null;

/**
 * Refreshes the SSO pair every back-end shares. Single flight: concurrent 401s wait for one call,
 * since Keycloak may rotate (and revoke) refresh tokens.
 */
export function refreshSso(): Promise<RefreshOutcome> {
  if (refreshing) return refreshing;
  const current = tokenStore.get();
  if (!current?.refreshToken) return Promise.resolve('rejected');

  refreshing = (async (): Promise<RefreshOutcome> => {
    try {
      const next = await refreshGrant(current.refreshToken);
      // Signed out (or in again) meanwhile: the new pair must not outlive that; a newer session is retried as is.
      if (tokenStore.get()?.refreshToken !== current.refreshToken) return tokenStore.get() ? 'refreshed' : 'rejected';
      await tokenStore.set(next.refreshToken ? next : { ...next, refreshToken: current.refreshToken, receivedAt: current.receivedAt });
      return 'refreshed';
    } catch (error) {
      return error instanceof SsoError && (error.status === 400 || error.status === 401) ? 'rejected' : 'unavailable';
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Ends the Keycloak session behind a refresh token. Best effort: signing out works offline too. */
export async function endSsoSession(refreshToken: string) {
  if (!env.sso.clientId || !refreshToken) return;
  try {
    await post('logout', { refresh_token: refreshToken });
  } catch {
    // Unreachable: the session expires on its own (SSO Session Idle).
  }
}
