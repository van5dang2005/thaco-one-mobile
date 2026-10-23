import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { env } from '@/core/config/env';

import { fetchStoreRelease } from '../api/storeRelease.api';
import { needsStoreUpdate, type StoreRelease } from '../utils/storeVersion';

/** Ask the store again when the app returns to the foreground, at most this often (the Play page weighs ~1.2 MB). */
const RECHECK_MS = 60 * 60 * 1000;

/** Development builds carry whatever version the local `.env` says: never lock them out. */
const enabled = Constants.expoConfig?.extra?.appEnv !== 'development';

/**
 * The store release that must be installed before the app can be used: the App Store / Google Play version is newer
 * than EXPO_PUBLIC_APP_VERSION. Checked at launch and when the app returns to the foreground; null while unknown,
 * offline or up to date, so a failed check never locks anyone out. Once found it stays until the new binary restarts
 * the app.
 */
export function useRequiredStoreUpdate(): StoreRelease | null {
  const [release, setRelease] = useState<StoreRelease | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let lastCheck = 0;
    const check = () => {
      if (Date.now() - lastCheck < RECHECK_MS) return;
      lastCheck = Date.now();
      fetchStoreRelease()
        .then((found) => {
          if (!cancelled && found && needsStoreUpdate(found, env.appVersion, String(Platform.Version))) setRelease(found);
        })
        // Offline or timed out: try again on the next return to the foreground.
        .catch(() => (lastCheck = 0));
    };
    check();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && check());
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return release;
}
