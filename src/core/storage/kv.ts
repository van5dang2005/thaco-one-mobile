import { createMMKV } from 'react-native-mmkv';

/** Small settings and per-device preferences. Never put secrets here (use SecureStore). */
export const kv = createMMKV({ id: 'thaco-one.settings' });

/** Persisted TanStack Query cache. Cleared on sign-out. */
export const queryCacheStore = createMMKV({ id: 'thaco-one.query-cache' });

export const kvKeys = {
  language: 'settings.language',
  colorScheme: 'settings.colorScheme',
  /** Profile → "Thông báo": pop a toast for live notifications (the bell badge updates either way). */
  notificationPopups: 'settings.notificationPopups',
  lastDomain: 'auth.lastDomain',
  lastUsername: 'auth.lastUsername',
  /** `{ id, username, email }` of the Keycloak account, to re-read `myApps` at launch. */
  ssoAccount: 'auth.ssoAccount',
  /** Apps the THACO apps portal grants the signed-in account (`MyApp[]`). */
  myApps: 'auth.myApps',
  /** "Ghi nhớ đăng nhập" at the last sign-in: off ends the session when the app starts again; on prefills the login form with `rememberedUsername`. */
  rememberLogin: 'auth.rememberLogin',
  rememberedUsername: 'auth.rememberedUsername',
  /** `{ username, domain, sessionId, userId }`: the account Face ID / fingerprint signs in, its Keycloak user and the Keycloak session of its offline token. Set only while biometric sign-in is on. */
  biometricAccount: 'auth.biometricSession',
  lastAreaId: 'rooms.lastAreaId',
  /** Expo push token last sent to the back-ends, so sign-out can withdraw it. */
  pushToken: 'push.token',
  /** The app has shown the system notification prompt once after sign-in; it never asks unprompted again. */
  pushPrompted: 'push.prompted',
} as const;

export function readJSON<T>(key: string): T | undefined {
  const raw = kv.getString(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function writeJSON(key: string, value: unknown) {
  kv.set(key, JSON.stringify(value));
}
