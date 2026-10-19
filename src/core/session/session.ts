import { setUnauthorizedHandler } from '@/core/api/http';
import type { LoginRequest } from '@/core/api/types';
import { unregisterPushToken } from '@/core/notifications/push';
import { clearQueryCache } from '@/core/query/queryClient';
import { kv, kvKeys, readJSON, writeJSON } from '@/core/storage/kv';

import { biometricAccount, type BiometricSession, disableBiometric, dropOrphanedCredentials, dropOthersBiometric, enableBiometric } from './biometric';
import { fetchMyApps, type MyApp } from './myApps';
import { type SignOutReason, useSessionStore } from './sessionStore';
import { endSsoSession, fetchSsoAccount, passwordGrant, refreshGrant, refreshTokenInfo, type SsoAccount } from './sso';
import { SsoError } from './SsoError';
import { type TokenPair, tokenStore } from './tokenStore';

/**
 * Keycloak login for the form: `name@domain` (Keycloak accepts the email) or, with no domain, the MSNV,
 * which is the Keycloak username. An email typed in full is kept as is.
 */
const ssoUsername = ({ username, domain }: LoginRequest) => (domain && !username.includes('@') ? `${username}@${domain}` : username);

function saveApps(apps: MyApp[] | null) {
  if (apps) writeJSON(kvKeys.myApps, apps);
  else kv.remove(kvKeys.myApps);
}

/**
 * Signs in through THACO SSO without a browser: the form's credentials go to Keycloak (Direct Access
 * Grant) and the realm's Account API confirms the token. That one token serves BOTH back-ends, whose
 * "Keycloak" scheme accepts it; the THACO apps portal (`my-apps`) then says which of them the account
 * may use, so the app never calls one that would answer 401 (and end the session).
 */
export async function signIn(request: LoginRequest) {
  const pair = await passwordGrant(ssoUsername(request), request.password);
  await startSession(pair, request, { endOnFailure: true });
}

/**
 * Face ID / fingerprint sign-in: trades the unlocked offline token for a fresh pair. The session stays on that
 * offline session, which signing out leaves alive for the next time. `expired`: Keycloak revoked it, or it went
 * unused past Offline Session Idle, so biometric sign-in was turned off.
 */
export async function signInWithBiometric({ refreshToken, account }: BiometricSession): Promise<'signedIn' | 'expired'> {
  let pair: TokenPair;
  try {
    pair = await refreshGrant(refreshToken);
  } catch (error) {
    if (!(error instanceof SsoError && error.code === 'INVALID_CREDENTIALS')) throw error;
    await disableBiometric();
    return 'expired';
  }
  await startSession({ ...pair, refreshToken: pair.refreshToken || refreshToken }, account, { endOnFailure: false });
  return 'signedIn';
}

/** Confirms a new pair with Keycloak and starts the app session on it. `endOnFailure`: the pair's Keycloak session may be ended when that fails. */
async function startSession(pair: TokenPair, login: Pick<LoginRequest, 'username' | 'domain'>, { endOnFailure }: { endOnFailure: boolean }) {
  let account: SsoAccount;
  try {
    account = await fetchSsoAccount(pair.token);
  } catch (error) {
    if (endOnFailure) void endSsoSession(pair.refreshToken);
    throw error;
  }
  // Best effort: while the portal's list is unknown no back-end is called and Home has no tiles; the next
  // launch or a pull-to-refresh on Home retries.
  const apps = await fetchMyApps(account).catch(() => null);
  await tokenStore.set(pair);

  kv.set(kvKeys.lastUsername, login.username);
  kv.set(kvKeys.lastDomain, login.domain);
  writeJSON(kvKeys.ssoAccount, { id: account.id, username: account.username, email: account.email } satisfies SsoAccount);
  saveApps(apps);
  // A different person may be signing in on a shared device; never show their cached data, and never let this
  // device's Face ID / fingerprint open the previous person's account again.
  clearQueryCache();
  await dropOthersBiometric({ login, userId: account.id });
  useSessionStore.getState().markSignedIn({ username: login.username, apps });
}

/**
 * Re-reads the granted apps (an admin may have changed them): at launch and on Home's pull-to-refresh.
 * Keeps the saved list when the portal is unreachable.
 */
export async function refreshMyApps() {
  const saved = kv.getString(kvKeys.ssoAccount);
  const account = readJSON<SsoAccount>(kvKeys.ssoAccount);
  if (!saved || !account) return;
  const apps = await fetchMyApps(account).catch(() => null);
  // Signed out, or in as someone else, meanwhile.
  if (!apps || useSessionStore.getState().status !== 'signedIn' || kv.getString(kvKeys.ssoAccount) !== saved) return;
  saveApps(apps);
  useSessionStore.getState().setApps(apps);
}

/**
 * Turns biometric sign-in on for `request`, whose password was just typed: Keycloak issues a separate offline
 * token (`offline_access`), and Face ID / fingerprint will unlock that token, never the password. Throws SsoError
 * when Keycloak refuses the password or offline tokens.
 *
 * Needs Keycloak's "Revoke Refresh Token" off (its default): with rotation, the stored token would stop working
 * once the session it opens refreshes.
 */
export async function enableBiometricSignIn(request: LoginRequest, prompt: string, cancelLabel: string): Promise<'enabled' | 'cancelled' | 'failed'> {
  let pair: TokenPair;
  try {
    pair = await passwordGrant(ssoUsername(request), request.password, { offline: true });
  } catch (error) {
    // The same grant works without offline_access, so a client refusal here is about offline tokens.
    if (error instanceof SsoError && error.code === 'SSO_CLIENT_REJECTED') throw new SsoError('SSO_OFFLINE_NOT_ALLOWED', error.message);
    throw error;
  }
  const { offline, sessionId, userId } = refreshTokenInfo(pair.refreshToken);
  if (!offline) {
    void endSsoSession(pair.refreshToken);
    throw new SsoError('SSO_OFFLINE_NOT_ALLOWED');
  }
  const outcome = await enableBiometric(
    { refreshToken: pair.refreshToken, account: { username: request.username, domain: request.domain, sessionId, userId } },
    prompt,
    cancelLabel,
  );
  // Not stored: nothing would ever use or end that session.
  if (outcome !== 'enabled') void endSsoSession(pair.refreshToken);
  return outcome;
}

/** The refresh token is on the offline session biometric sign-in opens. */
function onBiometricSession(refreshToken: string) {
  const sessionId = biometricAccount()?.sessionId;
  return !!sessionId && refreshTokenInfo(refreshToken).sessionId === sessionId;
}

/**
 * The refresh token ran out, timed as keycloak-js does: its lifetime (`exp - iat`, Keycloak's clock) against the
 * time elapsed on the device since it arrived, so a device clock that is off does not matter. Unknown (no `exp`,
 * or a pair saved before `receivedAt`): not expired, the first API call finds out.
 */
function refreshTokenExpired({ refreshToken, receivedAt }: TokenPair) {
  const { issuedAt, expiresAt } = refreshTokenInfo(refreshToken);
  if (issuedAt === null || expiresAt === null || receivedAt === undefined) return false;
  return Date.now() - receivedAt >= expiresAt - issuedAt;
}

let signingOut = false;

export async function signOut(reason: Exclude<SignOutReason, 'launch'> = 'user') {
  if (signingOut) return;
  signingOut = true;
  try {
    const pair = tokenStore.get();
    // Expired: Keycloak no longer knows the session. Biometric session: ending it would revoke the token
    // Face ID / fingerprint opens next time.
    if (pair && reason !== 'expired' && !onBiometricSession(pair.refreshToken)) void endSsoSession(pair.refreshToken);
    // Still signed in: stop this phone getting the account's pushes. An expired session cannot call the back-ends.
    if (reason !== 'expired') await unregisterPushToken();
    await tokenStore.clear();
    kv.remove(kvKeys.ssoAccount);
    kv.remove(kvKeys.myApps);
    clearQueryCache();
    useSessionStore.getState().markSignedOut(reason);
  } finally {
    signingOut = false;
  }
}

/**
 * Restores the SSO pair and the saved app list on cold start, then re-reads the list in the
 * background. The access token is validated lazily by the first API call.
 */
export async function restoreSession() {
  const [pair] = await Promise.all([tokenStore.restore(), dropOrphanedCredentials()]);
  if (!pair) {
    useSessionStore.getState().markSignedOut('launch');
    return;
  }
  if (refreshTokenExpired(pair)) {
    // Ran out while the app was closed: straight to the login screen ("session expired", Face ID), not to a
    // cached Home that the first API call would end.
    await signOut('expired');
    return;
  }
  const username = kv.getString(kvKeys.lastUsername) ?? null;
  // A session started by an app version that left the previous person's biometric sign-in on.
  if (username) await dropOthersBiometric({ login: { username, domain: kv.getString(kvKeys.lastDomain) ?? '' }, userId: readJSON<SsoAccount>(kvKeys.ssoAccount)?.id });
  const apps = readJSON<MyApp[]>(kvKeys.myApps) ?? null;
  useSessionStore.getState().markSignedIn({ username, apps });
  void refreshMyApps();
}

// Keycloak refused the refresh token: the login screen says the session expired.
setUnauthorizedHandler(() => {
  if (useSessionStore.getState().status !== 'signedIn') return;
  void signOut('expired');
});
