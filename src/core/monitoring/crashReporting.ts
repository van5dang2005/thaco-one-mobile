import { getCrashlytics, log, setAttributes, setUserId, type Crashlytics } from '@react-native-firebase/crashlytics';
import Constants from 'expo-constants';
import { usePathname } from 'expo-router';
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { TurboModuleRegistry } from 'react-native';

import { env } from '@/core/config/env';
import { useSessionStore } from '@/core/session/sessionStore';

/**
 * Crash reports (Firebase Crashlytics), production builds only. Native collection is switched per build
 * (`plugins/withCrashlyticsCollection`, APP_ENV), so native crashes are caught from the first launch; JS only
 * starts the module, whose global handler reports fatal JS errors with their JS stack (and unhandled promise
 * rejections as non-fatal), then tags reports with the signed-in user and the screens visited.
 */
let crashlytics: Crashlytics | null = null;

const isProduction = !__DEV__ && Constants.expoConfig?.extra?.appEnv === 'production';

/** Builds made before Crashlytics was added lack its native modules (a stray OTA update must not crash them). */
function hasNativeModules() {
  return TurboModuleRegistry.get('NativeRNFBTurboApp') != null && TurboModuleRegistry.get('NativeRNFBTurboCrashlytics') != null;
}

/** Call once, as early as possible: errors thrown before this are reported without their JS stack. */
export function startCrashReporting() {
  if (crashlytics || !isProduction || !hasNativeModules()) return;
  try {
    crashlytics = getCrashlytics();
  } catch {
    return;
  }
  const instance = crashlytics;
  void setAttributes(instance, {
    version: [env.appVersion, env.patchVersion && `patch ${env.patchVersion}`].filter(Boolean).join(' '),
    updateId: Updates.updateId ?? 'embedded',
  });
  const identify = (username: string | null) => void setUserId(instance, username ?? '');
  identify(useSessionStore.getState().username);
  useSessionStore.subscribe((state, prev) => {
    if (state.username !== prev.username) identify(state.username);
  });
}

/** Logs each route change, so a report shows the screens visited before the crash. */
export function useCrashBreadcrumbs() {
  const pathname = usePathname();
  useEffect(() => {
    if (crashlytics) log(crashlytics, `screen ${pathname}`);
  }, [pathname]);
}
