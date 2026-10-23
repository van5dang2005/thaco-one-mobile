import { compareVersions, needsStoreUpdate, parseAppStoreLookup, parsePlayPage } from '../storeVersion';

const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.thaco.one';

describe('compareVersions', () => {
  it('compares number by number, missing parts as 0', () => {
    expect(compareVersions('1.0.3', '1.0.0')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.3')).toBe(-1);
    expect(compareVersions('1.0.10', '1.0.9')).toBe(1);
    expect(compareVersions('2.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions(' 1.2.0 ', '1.2')).toBe(0);
  });

  it('gives no answer for something that is not a version', () => {
    expect(compareVersions('Varies with device', '1.0.0')).toBeNull();
    expect(compareVersions('1.0.0', '')).toBeNull();
    expect(compareVersions('1.0.0-beta', '1.0.0')).toBeNull();
  });
});

describe('needsStoreUpdate', () => {
  const release = { version: '1.0.3', storeUrl: PLAY_URL, minOs: '24' };

  it('locks only a build older than the store', () => {
    expect(needsStoreUpdate(release, '1.0.0', '34')).toBe(true);
    expect(needsStoreUpdate(release, '1.0.3', '34')).toBe(false);
    // A build ahead of the store (testers, release in review).
    expect(needsStoreUpdate(release, '1.1.0', '34')).toBe(false);
  });

  it('never locks a device whose OS is too old to install the new version', () => {
    expect(needsStoreUpdate(release, '1.0.0', '23')).toBe(false);
    expect(needsStoreUpdate({ ...release, minOs: '15.1' }, '1.0.0', '15.0')).toBe(false);
    expect(needsStoreUpdate({ ...release, minOs: '15.1' }, '1.0.0', '17.5')).toBe(true);
    expect(needsStoreUpdate({ ...release, minOs: null }, '1.0.0', '17.5')).toBe(true);
  });

  it('does not lock when the version cannot be compared', () => {
    expect(needsStoreUpdate({ ...release, version: 'Varies with device' }, '1.0.0', '34')).toBe(false);
  });
});

describe('parseAppStoreLookup', () => {
  it('reads version, page and minimum iOS of the first result', () => {
    // Shaped like `lookup?bundleId=com.thaco.esign&country=vn`.
    const reply = { resultCount: 1, results: [{ version: '1.0.3', trackViewUrl: 'https://apps.apple.com/vn/app/thaco-esign/id6759150412?uo=4', minimumOsVersion: '15.1' }] };
    expect(parseAppStoreLookup(reply)).toEqual({ version: '1.0.3', storeUrl: 'https://apps.apple.com/vn/app/thaco-esign/id6759150412?uo=4', minOs: '15.1' });
  });

  it('is null while the app is not on the store', () => {
    expect(parseAppStoreLookup({ resultCount: 0, results: [] })).toBeNull();
    expect(parseAppStoreLookup(null)).toBeNull();
  });
});

describe('parsePlayPage', () => {
  it('reads the version and minimum API level embedded in the app page', () => {
    // Excerpt of play.google.com/store/apps/details?id=com.thaco.esign (2026-10).
    const html = 'collection"]]],1],"141":[[["1.0.3"]],[[[36]],[[[24,"7.0"]]]]],"146":[["Sep 18, 2026",[1789703660,183000000]]]';
    expect(parsePlayPage(html, PLAY_URL)).toEqual({ version: '1.0.3', storeUrl: PLAY_URL, minOs: '24' });
  });

  it('keeps the version when the API levels are missing', () => {
    expect(parsePlayPage('"141":[[["1.0.14"]]]', PLAY_URL)).toEqual({ version: '1.0.14', storeUrl: PLAY_URL, minOs: null });
  });

  it('is null without a version block ("Varies with device", not published)', () => {
    expect(parsePlayPage('<html>Varies with device</html>', PLAY_URL)).toBeNull();
  });
});
