const { AndroidConfig, withAndroidManifest, withInfoPlist } = require('expo/config-plugins');

const key = 'rnfirebase_crashlytics_auto_collection_enabled';

/**
 * Turns Crashlytics collection on or off for the whole build, from the first launch and for native crashes too.
 * React Native Firebase reads `rnfirebase_*` keys from Info.plist / AndroidManifest meta-data when neither
 * firebase.json nor the JS setter sets them, so keep this key out of firebase.json.
 */
module.exports = function withCrashlyticsCollection(config, enabled = false) {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults[key] = enabled;
    return cfg;
  });
  return withAndroidManifest(config, (cfg) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(application, key, String(enabled));
    return cfg;
  });
};
