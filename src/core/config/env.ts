
function trimSlash(url: string) {
  return url.replace(/\/+$/, '');
}

/** A phone app Home opens: its link per platform (empty: none) and its store pages. */
export type PhoneApp = { url: { ios: string; android: string }; storeUrl: { ios: string; android: string } };

/**
 * Runtime configuration. EXPO_PUBLIC_* values are inlined at build time, so they must be read with
 * literal `process.env.EXPO_PUBLIC_…` member expressions.
 */
export const env = {
  /** Origin of thaco_be_ql_buu_pham (no trailing /api). */
  parcelApiUrl: trimSlash(process.env.EXPO_PUBLIC_PARCEL_API_URL ?? 'https://quanlybuuphamapi.thaco.com.vn/'),
  /** Origin of thaco_be_ql_phong_hop (no trailing /api). */
  roomApiUrl: trimSlash(process.env.EXPO_PUBLIC_ROOM_API_URL ?? 'https://datphonghopapi.thaco.com.vn/'),
  /** Origin of the guest-schedule back-end (gate check-in by QR; no trailing /api). Only the UAT host is known so far. */
  guestApiUrl: trimSlash(process.env.EXPO_PUBLIC_GUEST_API_URL || 'https://api01.thaco.com.vn'),
  /** Internal IT hotline behind "Liên hệ IT nội bộ" (login and Profile); empty shows a message instead. */
  itSupportPhone: process.env.EXPO_PUBLIC_IT_SUPPORT_PHONE ?? '',
  /** THACO apps portal: which applications (parcel, room, văn thư…) the signed-in account may use. */
  appsApiUrl: trimSlash(process.env.EXPO_PUBLIC_APPS_API_URL || 'https://appsapi.thaco.com.vn'),
  /**
   * Phone apps that a portal tile opens instead of its web app (`MyApp.url`), keyed by portal code: the link that
   * opens the app on each platform, and its store pages. The store page opens when the link fails (not installed),
   * or straight away on a platform with no link.
   */
  phoneApps: {
    ESIGN_WEB: {
      url: {
        ios: process.env.EXPO_PUBLIC_ESIGN_IOS_URL ?? 'com.thaco.esign://',
        // THACO ESIGN registers no link on Android: the Play Store page shows "Mở" when it is installed.
        android: process.env.EXPO_PUBLIC_ESIGN_ANDROID_URL ?? '',
      },
      storeUrl: {
        ios: process.env.EXPO_PUBLIC_ESIGN_IOS_STORE_URL ?? 'https://apps.apple.com/vn/app/thaco-esign/id6759150412',
        android: process.env.EXPO_PUBLIC_ESIGN_ANDROID_STORE_URL ?? 'https://play.google.com/store/apps/details?id=com.thaco.esign',
      },
    },
    PAYTIME: {
      url: {
        ios: process.env.EXPO_PUBLIC_PAYTIME_IOS_URL ?? 'thacopaytime://',
        android: process.env.EXPO_PUBLIC_PAYTIME_ANDROID_URL ?? 'thacopaytime://',
      },
      storeUrl: {
        ios: process.env.EXPO_PUBLIC_PAYTIME_IOS_STORE_URL ?? 'https://apps.apple.com/vn/app/thaco-paytime/id6762419210',
        android: process.env.EXPO_PUBLIC_PAYTIME_ANDROID_STORE_URL ?? 'https://play.google.com/store/apps/details?id=vn.com.thaco.paytime',
      },
    },
  } satisfies Record<string, PhoneApp>,
  sso: {
    issuer: trimSlash(process.env.EXPO_PUBLIC_SSO_ISSUER || 'https://sso.thaco.com.vn/realms/thacogroup'),
    clientId: process.env.EXPO_PUBLIC_SSO_CLIENT_ID ?? 'THACO_SSO',
    scope: process.env.EXPO_PUBLIC_SSO_SCOPES || 'openid profile email offline_access',
  },
  appVersion: process.env.EXPO_PUBLIC_APP_VERSION ?? '0.0.0',
  /** OTA patch number on top of appVersion; bump it on expo.dev before each `eas update`. Empty or 0 = no patch. */
  patchVersion: (process.env.EXPO_PUBLIC_PATCH_VERSION?.trim() ?? '').replace(/^0$/, ''),
  requestTimeoutMs: 20_000,
};

/** Login domains offered by the web apps (empty = log in with MSNV). */
export const loginDomains = ['thaco.com.vn', 'thagrico.vn', 'thiso.vn', 'emart.vn', 'thilogi.com.vn', 'thadico.vn', ''] as const;
