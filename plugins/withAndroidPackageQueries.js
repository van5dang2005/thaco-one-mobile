const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Makes `packages` visible to this app on Android 11+ (`<queries><package/></queries>`), which
 * expo-intent-launcher's `openApplication` needs to find their launcher activity.
 */
module.exports = function withAndroidPackageQueries(config, packages = []) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.queries = manifest.queries?.length ? manifest.queries : [{}];
    const queries = manifest.queries[0];
    const listed = new Set((queries.package ?? []).map((p) => p.$['android:name']));
    queries.package = [...(queries.package ?? []), ...packages.filter((name) => !listed.has(name)).map((name) => ({ $: { 'android:name': name } }))];
    return cfg;
  });
};
