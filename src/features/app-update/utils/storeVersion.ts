/** The version the store currently offers, where it opens, and the lowest OS that can install it. */
export type StoreRelease = {
  version: string;
  /** App Store / Google Play page of the app. */
  storeUrl: string;
  /** iOS: `minimumOsVersion` ("15.1"). Android: minimum API level ("24"). Unknown: null. */
  minOs: string | null;
};

/** `1.2.10` → [1, 2, 10]; null when it is not plain dotted numbers ("Varies with device"). */
function parts(version: string): number[] | null {
  const trimmed = version.trim();
  return /^\d+(\.\d+)*$/.test(trimmed) ? trimmed.split('.').map(Number) : null;
}

/** Compares dotted versions number by number ("1.0" = "1.0.0" < "1.0.10"); null when either is not a version. */
export function compareVersions(a: string, b: string): number | null {
  const x = parts(a);
  const y = parts(b);
  if (!x || !y) return null;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const diff = (x[i] ?? 0) - (y[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

/**
 * The update is forced only when the store has a newer version that this device can install: an OS older than
 * the release's minimum would be sent to a store page with no update button.
 */
export function needsStoreUpdate(release: StoreRelease, current: string, os: string): boolean {
  if (compareVersions(release.version, current) !== 1) return false;
  return !release.minOs || compareVersions(os, release.minOs) !== -1;
}

type LookupReply = { resultCount?: number; results?: { version?: string; trackViewUrl?: string; minimumOsVersion?: string }[] };

/** `GET https://itunes.apple.com/lookup?bundleId=…`: null while the app is not on the App Store of that country. */
export function parseAppStoreLookup(reply: LookupReply | null): StoreRelease | null {
  const app = reply?.results?.[0];
  if (!app?.version || !app.trackViewUrl) return null;
  return { version: app.version, storeUrl: app.trackViewUrl, minOs: app.minimumOsVersion ?? null };
}

/**
 * Google Play has no public version API: its app page embeds the release as `[[["1.0.3"]],[[[36]],[[[24,"7.0"]]`
 * (version, target API level, minimum API level and Android version). Null when the page has no such block (app
 * not published, "Varies with device", or Google changed the page).
 */
export function parsePlayPage(html: string, storeUrl: string): StoreRelease | null {
  const match = /\[\[\["(\d+(?:\.\d+)*)"\]\](?:,\[\[\[\d+\]\],\[\[\[(\d+),)?/.exec(html);
  if (!match) return null;
  return { version: match[1], storeUrl, minOs: match[2] ?? null };
}
