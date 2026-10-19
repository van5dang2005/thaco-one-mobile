import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { LoginRequest } from '@/core/api/types';
import { kv, kvKeys, readJSON, writeJSON } from '@/core/storage/kv';

/** The Keycloak offline refresh token biometric sign-in opens; never the password. */
const TOKEN_KEY = 'thaco.biometric.token';

/** App versions before offline tokens kept the domain password here, and its account under this MMKV key. */
const LEGACY_CREDENTIALS_KEY = 'thaco.biometric.credentials';
const LEGACY_ACCOUNT_KEY = 'auth.biometricAccount';

export type BiometricKind = 'face' | 'fingerprint' | 'none';

type Login = Pick<LoginRequest, 'username' | 'domain'>;

/**
 * The one account biometric sign-in opens on this device, its Keycloak user, and the Keycloak session of its offline
 * token. Not secret: the token stays in SecureStore. `userId` is missing on accounts saved by older app versions.
 */
export type BiometricAccount = Login & { sessionId: string | null; userId?: string | null };

/** Who has just signed in: the login typed (or the biometric one) and, when known, the Keycloak user. */
export type SignedInUser = { login: Login; userId?: string | null };

/** What Face ID / fingerprint unlocks: an offline refresh token, for `account`. */
export type BiometricSession = { refreshToken: string; account: BiometricAccount };

export type BiometricUnlock =
  | ({ status: 'ok' } & BiometricSession)
  | { status: 'cancelled' }
  /** The stored token can no longer be read (faces / fingerprints changed on the device), so biometric sign-in was turned off. */
  | { status: 'invalidated' }
  /** Locked out after too many attempts, sensor error… */
  | { status: 'failed' };

export async function biometricKind(): Promise<BiometricKind> {
  try {
    const [hasHardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    if (!hasHardware || !enrolled) return 'none';
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const { FACIAL_RECOGNITION, FINGERPRINT } = LocalAuthentication.AuthenticationType;
    if (Platform.OS === 'android') {
      // The checks above count Class 2 biometrics too, such as the 2D face unlock of most Android phones, but the
      // SecureStore prompt takes only Class 3 ones: offer it only with a strong one enrolled, and name the fingerprint,
      // which that prompt accepts on nearly every phone.
      if ((await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG) return 'none';
      if (types.includes(FINGERPRINT)) return 'fingerprint';
      return types.includes(FACIAL_RECOGNITION) ? 'face' : 'none';
    }
    if (types.includes(FACIAL_RECOGNITION)) return 'face';
    if (types.includes(FINGERPRINT)) return 'fingerprint';
    return 'none';
  } catch {
    return 'none';
  }
}

/** Both platforms reject a dismissed SecureStore prompt with a "User canceled …" message, not a dedicated code. */
const isCancel = (error: unknown) => /cancel/i.test(error instanceof Error ? error.message : String(error));

const sameAccount = (a: Login, b: Login) => a.username.trim().toLowerCase() === b.username.trim().toLowerCase() && a.domain === b.domain;

export function biometricAccount(): BiometricAccount | null {
  return readJSON<BiometricAccount>(kvKeys.biometricAccount) ?? null;
}

/**
 * The biometric account is `user`'s: the same Keycloak user when both ids are known, so signing in by MSNV or by email
 * counts as one person; otherwise the same username and domain.
 */
const ownedBy = (enabled: BiometricAccount, user: SignedInUser) =>
  enabled.userId && user.userId ? enabled.userId === user.userId : sameAccount(enabled, user.login);

/**
 * Biometric sign-in is set up on this device. Once signed in, it is the signed-in user's: signing in as anyone else
 * turns it off (`dropOthersBiometric`).
 */
export function isBiometricEnabled() {
  return !!biometricAccount();
}

/**
 * After a sign-in: when biometric sign-in belongs to another account (someone else used this device before), turn it
 * off, so this device's Face ID / fingerprint can no longer open that account's session.
 */
export async function dropOthersBiometric(user: SignedInUser) {
  const enabled = biometricAccount();
  if (enabled && !ownedBy(enabled, user)) await disableBiometric();
}

/**
 * Stores the offline token in the keychain/keystore, readable only after a biometric check, and makes its account
 * the device's biometric one (replacing any other). Opt-in, right after Keycloak accepted the password.
 */
export async function enableBiometric(session: BiometricSession, prompt: string, cancelLabel: string): Promise<'enabled' | 'cancelled' | 'failed'> {
  try {
    if (Platform.OS === 'ios') {
      // iOS writes the keychain item without asking, so check Face ID first: it proves it works for this
      // user and asks for the Face ID permission now rather than at the next sign-in.
      const check = await LocalAuthentication.authenticateAsync({ promptMessage: prompt, cancelLabel, disableDeviceFallback: true, fallbackLabel: '' });
      if (!check.success) return ['user_cancel', 'system_cancel', 'app_cancel'].includes(check.error) ? 'cancelled' : 'failed';
      // Updating an existing item would ask for Face ID a second time; replace it instead.
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
    // Android's keystore asks for the fingerprint here.
    await SecureStore.setItemAsync(TOKEN_KEY, session.refreshToken, {
      requireAuthentication: true,
      authenticationPrompt: prompt,
      // iOS: never in a backup or on another device, and dropped if the device passcode is removed.
      keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    });
  } catch (error) {
    return isCancel(error) ? 'cancelled' : 'failed';
  }
  const { username, domain, sessionId, userId } = session.account;
  writeJSON(kvKeys.biometricAccount, { username: username.trim(), domain, sessionId, userId } satisfies BiometricAccount);
  return 'enabled';
}

/** Reads the stored token; the OS shows the Face ID / fingerprint prompt. */
export async function unlockBiometric(prompt: string): Promise<BiometricUnlock> {
  const account = biometricAccount();
  if (!account) return { status: 'invalidated' };
  let refreshToken: string | null;
  try {
    refreshToken = await SecureStore.getItemAsync(TOKEN_KEY, { requireAuthentication: true, authenticationPrompt: prompt });
  } catch (error) {
    return { status: isCancel(error) ? 'cancelled' : 'failed' };
  }
  // SecureStore answers null once new biometrics invalidated the key: the token can never be read again.
  if (!refreshToken) {
    await disableBiometric();
    return { status: 'invalidated' };
  }
  return { status: 'ok', refreshToken, account };
}

/**
 * Turns biometric sign-in off on this device. Reading the token back would need Face ID, so its Keycloak session
 * is left to expire (Offline Session Idle), unless the app is on it: then signing out ends it.
 */
export async function disableBiometric() {
  kv.remove(kvKeys.biometricAccount);
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/**
 * Launch cleanup; deleting needs no Face ID. iOS keeps keychain items after the app is deleted, MMKV does not,
 * so a reinstall would leave the old token there with nothing pointing at it; and older app versions kept the
 * domain password.
 */
export async function dropOrphanedCredentials() {
  kv.remove(LEGACY_ACCOUNT_KEY);
  await Promise.all([
    SecureStore.deleteItemAsync(LEGACY_CREDENTIALS_KEY).catch(() => undefined),
    biometricAccount() ? undefined : SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined),
  ]);
}
