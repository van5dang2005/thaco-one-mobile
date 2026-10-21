import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * App config. Env values live on expo.dev (EAS environment variables): `npm run env:pull*` writes
 * them to the single local `.env`, which Expo CLI loads before evaluating this file. EAS builds read
 * the profile's environment directly; `eas.json` sets APP_ENV per profile.
 */
type AppEnv = 'development' | 'preview' | 'production';

const appEnv: AppEnv = (['development', 'preview', 'production'] as const).find((v) => v === process.env.APP_ENV) ?? 'development';

/**
 * User-facing version (iOS CFBundleShortVersionString, Android versionName), from EXPO_PUBLIC_APP_VERSION
 * on expo.dev, which the app also shows. Build numbers (ios.buildNumber, android.versionCode) are not
 * set here: EAS keeps them and bumps them on every build (`appVersionSource: "remote"` + `autoIncrement`).
 */
const version = process.env.EXPO_PUBLIC_APP_VERSION?.trim() || '0.0.0';
if (!/^\d+(\.\d+){0,2}$/.test(version)) throw new Error(`EXPO_PUBLIC_APP_VERSION must look like 2.4.0, got "${version}"`);

/** Non-production builds are labelled on the home screen so testers can tell them apart. */
const nameSuffix: Record<AppEnv, string> = { development: '(Dev) ', preview: '(Beta) ', production: '' };

/** expo.dev project `@nguyenvandang/thaco-one-mobile`; also the EAS Update endpoint. */
const easProjectId = 'a20357f7-e209-4655-bb90-a2456a02f774';

const cameraPermission = 'THACO ONE dùng camera để chụp ảnh bưu phẩm khi tiếp nhận và quét mã QR của khách.';
const photosPermission = 'THACO ONE cần truy cập thư viện ảnh để đính kèm ảnh bưu phẩm.';
const faceIdPermission = 'THACO ONE dùng Face ID để đăng nhập nhanh.';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: `${nameSuffix[appEnv]}THACO ONE`,
  slug: 'thaco-one-mobile',
  owner: 'nguyenvandang',
  version,
  /**
   * OTA updates (EAS Update). A build only takes updates published with the same runtime version, here the
   * app version: bump EXPO_PUBLIC_APP_VERSION whenever native code or native config changes, or the old
   * build would download JS it cannot run. Each build profile listens on its own channel (`eas.json`).
   */
  runtimeVersion: { policy: 'appVersion' },
  updates: { url: `https://u.expo.dev/${easProjectId}` },
  /**
   * Mobile only. `eas update` exports with `--platform=all`, which also renders web statically on the server,
   * where module-level MMKV reads (i18n, auth) crash and fail the update.
   */
  platforms: ['ios', 'android'],
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'thacoone',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.thaco.one',
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription: cameraPermission,
      NSPhotoLibraryUsageDescription: photosPermission,
      NSFaceIDUsageDescription: faceIdPermission,
      LSApplicationQueriesSchemes: ['vn.com.thaco.paytime'],
      // Export compliance: only the OS's HTTPS/TLS and Keychain, which are exempt, so App Store Connect stops asking.
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.thaco.one',
    adaptiveIcon: {
      backgroundColor: '#00539B',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    permissions: ['android.permission.CAMERA', 'android.permission.USE_BIOMETRIC', 'android.permission.RECORD_AUDIO', 'android.permission.USE_FINGERPRINT'],
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    // No floating dev tools button in development builds (the dev menu still opens with Cmd+D / Cmd+M or a shake).
    ['expo-dev-client', { toolsButton: false }],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#00539B',
        image: './assets/images/splash-icon.png',
        imageWidth: 220,
        dark: { backgroundColor: '#0B1420', image: './assets/images/splash-icon.png' },
      },
    ],
    'expo-secure-store',
    'expo-sharing',
    ['expo-image-picker', { cameraPermission, photosPermission }],
    ['expo-camera', { cameraPermission, microphonePermission: false, recordAudioAndroid: false }],
    ['expo-local-authentication', { faceIDPermission: faceIdPermission }],
    'expo-notifications',
    // Home tiles open these by package on Android (`env.phoneApps.*.androidPackage`): neither registers a link there.
    ['./plugins/withAndroidPackageQueries', ['com.thaco.esign', 'vn.com.thaco.paytime']],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    appEnv,
    router: {},
    eas: { projectId: easProjectId },
  },
});
