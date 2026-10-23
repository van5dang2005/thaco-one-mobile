import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { fetchWithTimeout } from '@/core/api/fetchWithTimeout';
import { buildUrl } from '@/core/api/http';
import { env } from '@/core/config/env';

import { parseAppStoreLookup, parsePlayPage, type StoreRelease } from '../utils/storeVersion';

/** THACO ONE is listed in the Vietnamese stores: another country's App Store answers no result. */
const COUNTRY = 'vn';

/** Bundle id / package of this build (app.config.ts `ios.bundleIdentifier`, `android.package`). */
function appId() {
  const config = Constants.expoConfig;
  return (Platform.OS === 'ios' ? config?.ios?.bundleIdentifier : config?.android?.package) ?? 'com.thaco.one';
}

/** No caches in between: the App Store lookup sits behind a CDN that keeps answering the old version for hours. */
const noCache = { 'Cache-Control': 'no-cache', Pragma: 'no-cache' };

async function appStoreRelease(): Promise<StoreRelease | null> {
  const url = buildUrl('https://itunes.apple.com', '/lookup', { bundleId: appId(), country: COUNTRY, _: Date.now() });
  const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json', ...noCache } }, env.requestTimeoutMs);
  if (!response.ok) return null;
  return parseAppStoreLookup(await response.json().catch(() => null));
}

async function playRelease(): Promise<StoreRelease | null> {
  const page = (query: Record<string, string>) => buildUrl('https://play.google.com', '/store/apps/details', { id: appId(), ...query });
  const response = await fetchWithTimeout(page({ hl: 'vi', gl: COUNTRY.toUpperCase() }), { headers: noCache }, env.requestTimeoutMs);
  // 404 while the app is not published.
  if (!response.ok) return null;
  return parsePlayPage(await response.text(), page({}));
}

/** The release this platform's store offers now; null when the app is not listed or the version cannot be read. */
export function fetchStoreRelease(): Promise<StoreRelease | null> {
  return Platform.OS === 'ios' ? appStoreRelease() : playRelease();
}
