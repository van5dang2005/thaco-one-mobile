This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in the root `app/` folder (there is deliberately no `src/app/`, which would take precedence) — every file there is a screen, `_layout.tsx` files define navigators. Keep route files thin; screens and logic live in `src/features/*`, shared UI in `src/shared/ui`, infrastructure in `src/core`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Each `src/features/<feature>/` uses the same layout: `api/<name>.api.ts` (endpoint objects), `components/`, `hooks/` (one `useX.ts` per hook), `schemas/<name>.schema.ts` (zod), `screens/` (what routes render), `store/` (zustand), `utils/` (pure logic), `types.ts`, and `index.ts`. `index.ts` exports only the screens `app/` renders; routes import `@/features/<feature>`, while other features import the exact module (`@/features/room-booking/hooks/useRooms`) so feature barrels never form require cycles. Query keys stay central in `src/core/query/keys.ts` (realtime invalidates whole groups).
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.config.ts` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Project notes

- Two back-ends, one token: `src/core/api/clients.ts` (`parcelApi`, `roomApi`) both send the single SSO pair from `tokenStore`. Never mix user ids between them; each service has its own `users/me`.
- Sign-in is THACO SSO only (`src/core/session/sso.ts`): the login form sends `name@domain`, or the MSNV (Keycloak's username), with the password to Keycloak (Direct Access Grant, no browser); `/api/auth/login` is never called. Sign-in confirms the token with Keycloak's Account API (`GET {issuer}/account`), not the back-ends; roles come from each service's `users/me`. The one Keycloak pair is stored once (`src/core/session/tokenStore.ts`) and serves every back-end; it is refreshed against Keycloak (`refreshSso`), never `/api/auth/refresh-token`. Only Keycloak refusing the refresh token (400/401) signs the user out (reason `expired`: banner on the login form); a network error, timeout or 5xx keeps the session and surfaces as `NETWORK`. At launch a refresh token past its lifetime (`exp - iat`, timed from `receivedAt` on the device clock) goes straight to the login screen. A back-end accepts it only if `resource_access.<Policy:Client>.roles` holds its `Policy:Roles`. Which back-ends the account may use comes from the THACO apps portal (`src/core/session/myApps.ts`, `GET {EXPO_PUBLIC_APPS_API_URL}/api/Application/my-apps?id=&username=&email=` with the Keycloak account), kept as `useSessionStore(s => s.apps)`; `connected` is derived from it (`serviceAppCodes`: `PARCEL_MANAGEMENT_WEB` → `connected.parcel`, `BOOKING_ROOM_WEB` → `connected.room`). Fetched at sign-in, at each launch and on Home's pull-to-refresh; while the portal's list is unknown no back-end is on. `EXPO_PUBLIC_SSO_CLIENT_ID` is required.
- Home tiles come from the same list (`appModules`, `src/features/home/utils/moduleFilter.ts`), never from a fixed set: each granted app with screens here brings its tiles from `nativeModules` (`src/features/home/modules.ts`), in the portal's `displayOrder`; every other granted app gets one tile that opens its web `url` under the portal's `name` and `icon`. A new back-end starts at `ServiceId` (`src/core/api/ApiError.ts`): the compiler then asks for its client (`clients.ts`) and portal code (`serviceAppCodes`); add its tiles to `nativeModules`. Notifications never branch per module: each one declares a `NotificationSource` (`src/features/<feature>/utils/notificationSource.ts`: list/unread/read/delete calls mapped onto `AppNotification`, a row look (icon + tone) per notification, routes, SignalR hub and its events) and lists it in `src/features/notification/utils/sources.ts`; the screen, bell badge, toasts (`RealtimeProvider`) and push taps (`PushNotificationsProvider`) only loop over that list. The screen's "Tất cả" chip merges every source newest first (`utils/feed.ts`: each source pages on its own, rows wait in the cursor until no source can still have newer ones). Back-ends on the shared .NET template (parcel, room) build theirs with `templateSource()`; one of another shape (Văn thư) writes the calls itself, leaving out those it lacks (the screen hides their buttons). The source `id` is the `service` its back-end puts in push `data`.
- Văn thư (`thaco_be_ql_van_thu`, VANTHU.md) is a third back-end on the same SSO token but another shape: `documentApi` (`clients.ts`, `EXPO_PUBLIC_DOCUMENT_API_URL`) stays out of `ServiceId`; `src/features/official-document/api/officialDocument.api.ts` unwraps `{ success, message, data }`, `utils/mapping.ts` maps its DTOs (`api/dto.ts`). Its times are Vietnam wall-clock without a zone (`vtDateKey` / `vtInstant`, not `parseServerDate`); it has no `errorCode`, so `errorMessage()` shows its 4xx `message` as is. Rights come per row (`can*`), use them instead of re-deriving. `POST /api/VanBan/ChiaSe` takes the final list: send every current holder back. Whole staff lists use `meta: { persist: false }` (skipped by the persisted query cache).
- Biometric sign-in (`src/core/session/biometric.ts`, orchestrated in `session.ts`) never stores the password: enabling it makes a separate password grant with `offline_access` and keeps that Keycloak **offline refresh token** behind Face ID / fingerprint (SecureStore `requireAuthentication`). Face ID sign-in trades it for a pair (`refreshGrant`); `signOut` must NOT call Keycloak logout while the session is that offline session (same `sid` as `biometricAccount().sessionId`), or the token dies. Keycloak answering `invalid_grant` turns biometric sign-in off. Needs Keycloak's "Revoke Refresh Token" off (default).
- Enums are numeric on the wire; use the TS enums in `src/features/*/types.ts`. Times are UTC on the wire and shown in Vietnam time via `src/core/time/vn.ts`.
- Every server error carries `errorCode`; map it with `errorMessage()` (`src/core/errors`). Add new codes to both locale files.
- UI strings live in `src/core/i18n/locales/{vi,en}.ts` only.
- Versions: `version` comes from `EXPO_PUBLIC_APP_VERSION` (expo.dev), the same value `env.appVersion` shows. Build numbers (`ios.buildNumber`, `android.versionCode`) live on EAS (`appVersionSource: "remote"`, `autoIncrement` in every profile); never set them in `app.config.ts`.
- Crash reports: Firebase Crashlytics (`@react-native-firebase/*` pinned to 26.x: iOS uses CocoaPods + static frameworks; v27 is SPM-only and needs dynamic frameworks). Only production builds collect, switched at build time by `plugins/withCrashlyticsCollection.js` from `APP_ENV`; `src/core/monitoring/crashReporting.ts` adds user id, version/updateId and route breadcrumbs, and stays off when the native modules are missing. The Firebase files (`google-services.json`, `GoogleService-Info.plist`) are git-ignored; their base64 copies are `GOOGLE_SERVICES_JSON_BASE64` / `GOOGLE_SERVICES_PLIST_BASE64`.
- App config is `app.config.ts` (there is no `app.json`). Env vars live on expo.dev (EAS environment variables); locally there is a single git-ignored `.env`, written by `npm run env:pull[:preview|:prod]`. EAS builds read the profile's `environment` from `eas.json`, never the local `.env`. `APP_ENV` picks the app name suffix.
- Pinned to Expo SDK 55 because SDK 57 needs Xcode ≥ 26.4. The universal `@expo/ui` layer (and the `expo-ui` skill's universal examples) needs SDK 56+, so on SDK 55 only `@expo/ui/swift-ui` and `@expo/ui/jetpack-compose` exist.
- Icons: lucide (`lucide-react-native`), imported only through `src/shared/ui/icons.ts`, one `lucide-react-native/icons/<name>` file per icon, and rendered with `<Icon>` (stroke 1.8, `bold` 2.2). Never import from the `lucide-react-native` or `@expo-google-fonts/*` package roots: Metro would bundle every icon / weight.
- UI is the v3 design (`../design_handoff_thaco_hrm_mobile/PROMPT_V3.md`): build module screens from `ModuleScreen` + `ModuleHeader` (+ `FloatingCard`), shadows from `src/shared/ui/shadows.ts`, tones from `src/shared/ui/tones.ts`.
- UI font is fixed to Be Vietnam Pro, JetBrains Mono for codes and numbers (`src/core/theme/fonts.ts`). Render text with `<Text>` / `useFontStyle()`, never a hard-coded `fontFamily`.
