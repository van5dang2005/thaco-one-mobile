# THACO ONE (mobile)

Ứng dụng di động nội bộ cho nhân viên THACO (iOS + Android), gồm hai mảng nối với hai back-end riêng:

- **Phòng họp** (`thaco_be_ql_phong_hop`): lịch phòng, đặt phòng (lặp lịch), phê duyệt nhiều cấp, gia hạn / kết thúc sớm / hủy.
- **Bưu phẩm** (`thaco_be_ql_buu_pham`): bưu phẩm của tôi, ủy quyền nhận thay, lễ tân tiếp nhận và bàn giao.

Tiện ích trên trang chủ lấy theo các ứng dụng mà cổng ứng dụng THACO (`my-apps`) cấp cho tài khoản: ứng dụng có màn hình riêng trong app (phòng họp, bưu phẩm) hiện các ô của nó, ứng dụng khác hiện một ô mở bản web.

Stack: Expo SDK 55 (React Native 0.83, Expo Router, React Compiler), TypeScript strict, TanStack Query, Zustand, NativeWind, react-hook-form + zod, expo-secure-store, react-native-mmkv, @microsoft/signalr, i18next (vi mặc định, en).

## Chạy thử

Yêu cầu: Node 20+, Android Studio (emulator) và/hoặc **Xcode ≥ 26.4** (xem mục iOS).

```bash
npm install
npm run env:pull               # tải biến môi trường development từ expo.dev về .env
npm start                      # Metro
npm run android                # build + cài development build lên emulator / máy thật
```

### Cấu hình và môi trường

Cấu hình app nằm ở `app.config.ts`. Biến môi trường được quản lý trên **expo.dev** (EAS environment variables, ba môi trường development / preview / production). Ở máy dev chỉ có **một file `.env`** (git bỏ qua), được ghi đè mỗi lần pull.

| Biến | Ý nghĩa |
|---|---|
| `APP_ENV` | development / preview / production; đổi tên app thành "THACO ONE (Dev)" / "(Preview)" / "THACO ONE". Khi build, `eas.json` tự đặt theo profile |
| `EXPO_PUBLIC_PARCEL_API_URL`, `EXPO_PUBLIC_ROOM_API_URL` | Gốc URL hai back-end (không có `/api`). Back-end .NET chạy local: `http://localhost:5211` (bưu phẩm), `http://localhost:5113` (phòng họp) |
| `EXPO_PUBLIC_ESIGN_IOS_URL`, `EXPO_PUBLIC_ESIGN_ANDROID_URL`, `EXPO_PUBLIC_ESIGN_IOS_STORE_URL`, `EXPO_PUBLIC_ESIGN_ANDROID_STORE_URL` | Ô "Trình ký hồ sơ THACO" (portal `ESIGN_WEB`) mở app THACO ESIGN thay vì web; không mở được thì gợi ý cửa hàng. Link để trống: mở thẳng trang cửa hàng (Android E-Sign chưa có link). Mặc định nằm trong `src/core/config/env.ts` |
| `EXPO_PUBLIC_PAYTIME_IOS_URL`, `EXPO_PUBLIC_PAYTIME_ANDROID_URL`, `EXPO_PUBLIC_PAYTIME_IOS_STORE_URL`, `EXPO_PUBLIC_PAYTIME_ANDROID_STORE_URL` | Ô "Chấm công PAYTIME" (portal `PAYTIME`) mở app THACO Paytime (`vn.com.thaco.paytime://`, theo bundle id như E-Sign), tương tự |
| `EXPO_PUBLIC_SSO_ISSUER`, `EXPO_PUBLIC_SSO_CLIENT_ID`, `EXPO_PUBLIC_SSO_SCOPES` | THACO SSO (Keycloak). Form đăng nhập luôn gửi tài khoản tới realm này (không mở trình duyệt), nên `CLIENT_ID` bắt buộc: client public, bật *Direct access grants*. Mặc định issuer `https://sso.thaco.com.vn/realms/thacogroup`, scope `openid profile email` |
| `EXPO_PUBLIC_IT_SUPPORT_PHONE` | Số hotline IT ở màn đăng nhập (tùy chọn) |

`EXPO_PUBLIC_*` được nhúng thẳng vào app nên không để bí mật trong đó. Khi tạo biến trên expo.dev, chọn visibility **Plain text** hoặc **Sensitive**: build local không đọc được biến **Secret**.

Build EAS (local lẫn cloud) tự lấy biến của môi trường ứng với profile (`environment` trong `eas.json`), không dùng `.env` trên máy.

| Lệnh | Việc |
|---|---|
| `npm run env:pull` · `env:pull:preview` · `env:pull:prod` | Ghi đè `.env` bằng biến development / preview / production trên expo.dev |
| `npm run env:push` | Đẩy `.env` hiện tại lên expo.dev (hỏi chọn môi trường) |
| `npm start` · `start:clear` · `start:prod` | Metro · xoá cache · chế độ production (tắt dev, minify) |
| `npm run android` · `ios` | Build + cài development build |
| `npm run android:release` · `ios:release` | Build release lên emulator / simulator, dùng `.env` hiện tại |
| `npm run build:preview` · `build:production` | Build trên cloud EAS cho cả iOS và Android theo profile |
| `npm run build:android:preview` · `build:android:prod` | Build Android trên cloud EAS (preview ra APK, production ra AAB) |
| `npm run build:ios:preview` · `build:ios:prod` | Build iOS trên cloud EAS (preview: ad hoc, cài trên máy đã đăng ký; prod: App Store) |
| `npm run update:production` | Phát hành bản cập nhật OTA (JS + ảnh) cho các bản build production, xem mục "Cập nhật OTA" |
| `npm run check` | typecheck + lint + test |
| `npm run doctor` · `native:clean` | `expo-doctor` · prebuild lại `ios/` `android/` từ đầu |

Build cần `eas login`. Lần build đầu EAS hỏi tạo keystore Android và chứng chỉ iOS: chọn Yes, chúng được lưu trên EAS và dùng lại cho các lần sau. Upload lên App Store Connect: `eas submit -p ios --latest`.

Android emulator cần chuyển cổng để `localhost` trỏ về máy dev:

```bash
adb reverse tcp:8081 tcp:8081 && adb reverse tcp:5211 tcp:5211 && adb reverse tcp:5113 tcp:5113
```

### Cập nhật OTA (EAS Update)

Sửa JS, giao diện, chữ, ảnh thì không cần build lại: phát hành bản cập nhật, app kiểm tra khi mở (và khi quay lại app, tối đa 10 phút một lần) rồi hiện popup **"Đã có bản cập nhật mới"** (`src/features/app-update`). Người dùng bấm **Cập nhật ngay** thì app tải bản mới và khởi động lại sau vài giây; bấm **Để sau** thì bản mới tự áp dụng ở lần mở app tới. Popup không hiện trong môi trường development.

```bash
npm run update:production -- --message "Sửa lỗi hiển thị bưu phẩm"
```

- Mỗi profile build nghe một channel riêng (`channel` trong `eas.json`): `update:production` chỉ tới các bản production (kể cả bản đã lên App Store). Bản preview nhận update qua `APP_ENV=preview eas update --channel preview --environment preview`.
- Bản build chỉ nhận update có cùng **runtime version**, ở đây chính là `EXPO_PUBLIC_APP_VERSION`. Khi thêm thư viện native, đổi quyền, icon, splash, bundle id hoặc bất kỳ gì trong `app.config.ts` ngoài JS: **tăng `EXPO_PUBLIC_APP_VERSION` rồi build lại**, không dùng OTA. Nếu quên tăng, bản build cũ sẽ tải JS cần native mới và bị crash.
- Bản update đọc biến môi trường của EAS (`--environment`), không đọc `.env` local.
- Đánh số bản vá: trước mỗi lần `update:production`, tăng `EXPO_PUBLIC_PATCH_VERSION` của môi trường production trên expo.dev (`eas env:update`). Màn hình Hồ sơ hiện "v1.0.0 (patch 3)". Khi build bản mới (tăng `EXPO_PUBLIC_APP_VERSION`), đặt lại về trống hoặc `0`.
- Lỗi sau khi phát hành: `eas update:rollback` (hoặc publish lại commit trước).

### iOS

Dự án dùng Expo SDK 55, build được với Xcode 26.3. SDK 57 cần Xcode ≥ 26.4 nên đã hạ về 55.

```bash
LANG=en_US.UTF-8 npm run ios   # CocoaPods cần locale UTF-8
```

Không có Xcode thì build trên cloud bằng EAS Build (`npx eas-cli@latest build -p ios --profile preview`, profile trong `eas.json`).

### Phông chữ và icon

- Toàn bộ giao diện dùng **Be Vietnam Pro** (theo thiết kế), cố định, không cho người dùng đổi. Khai báo ở `src/core/theme/fonts.ts`.
- Mã, MSNV, giờ, số đếm luôn dùng **JetBrains Mono** (`<Text mono>`).
- Icon là **lucide** (`lucide-react-native`). Chỉ import từ `src/shared/ui/icons.ts` (mỗi icon một file `lucide-react-native/icons/<tên>`), không import từ gốc `lucide-react-native`, vì Metro không tree-shake và sẽ nhúng cả ~1900 icon. Ở gốc `@expo-google-fonts/*` cũng vậy: import theo từng độ đậm (`@expo-google-fonts/be-vietnam-pro/400Regular`).

## Kiểm tra

```bash
npm run typecheck
npm run lint
npm test           # Jest (jest-expo): src/**/__tests__
npm run e2e        # Maestro, cần Metro + app đã cài trên emulator
```

Các luồng e2e trong `.maestro/` chạy theo thứ tự: đặt phòng (lan.nt) → duyệt (khoa.nm) → tiếp nhận bưu phẩm → bàn giao (nhung.vh). Chúng được viết theo dữ liệu của mock API cũ (đã gỡ): tài khoản lan.nt / khoa.nm / nhung.vh, mật khẩu `123456`, phòng Tam Hiệp…, nên cần tài khoản và dữ liệu tương ứng trên back-end thật mới chạy được.

## Cấu trúc

```
app/                      Route (Expo Router), chỉ là lớp mỏng gọi màn trong src/features
  (auth)/login            Đăng nhập
  (app)/(tabs)/           Trang chủ · Duyệt · Lịch · Cá nhân
  (app)/rooms/            Lịch phòng, wizard đặt phòng, chi tiết phiếu
  (app)/parcels/          Bưu phẩm của tôi, chi tiết, ủy quyền, lễ tân (reception/)
src/core/                 Hạ tầng: api (2 client + refresh token), session, realtime (SignalR),
                          errors (errorCode → câu tiếng Việt), i18n, theme, time (giờ VN)
src/shared/ui/            Design system dùng chung: ScreenShell, HeaderBar, Header*, Card, StatusBadge, BottomSheet… (xem `/ui` trong bản dev)
src/features/*            Màn hình + logic nghiệp vụ theo mảng
.maestro/                 Luồng e2e
```

Quy ước chính:

- Hai service, hai bộ token (`src/core/api/clients.ts`). Id người dùng của hai service khác nhau, không dùng lẫn.
- Enum đi trên dây dạng số (xem `src/features/*/types.ts`). Thời gian là UTC trên dây, hiển thị theo giờ Việt Nam qua `src/core/time/vn.ts`.
- Mọi lỗi nghiệp vụ hiển thị qua `errorMessage()` theo `errorCode`. Thêm mã mới vào cả hai file ngôn ngữ.
- Chuỗi giao diện chỉ nằm trong `src/core/i18n/locales/{vi,en}.ts`.
- Tải tệp lên dùng `appendLocalFile()` (`src/shared/lib/upload.ts`): `fetch` toàn cục của Expo là `expo/fetch`, không nhận dạng `{ uri, name, type }` của React Native.
- Quyền lễ tân suy ra từ `GET /api/menus` có mục `/buu-kien` (API `my-permissions` chỉ dành cho Administrator).

## Điểm cần back-end xem lại

Phát hiện khi đọc mã nguồn back-end, app đang làm vòng qua:

- **Bàn giao hàng loạt** (`BulkConfirmParcelHandoverCommandHandler`) gán `item.ActualReceiverCode = item.ActualReceiverCode`, nên không lưu MSNV người nhận thực tế. App dùng `/handover` khi chỉ có một bưu phẩm.
- **Giờ hoạt động phòng** được so với giờ UTC ở server, còn web hiểu là giờ Việt Nam. Cuộc họp vắt qua 07:00 giờ VN có thể bị báo ngoài giờ.
- `DelegationDto` không có `pendingEndDate` (chỉ `RelatedDelegation` có), nên danh sách ủy quyền không hiện được "Chờ xác nhận gia hạn đến …".
- `BookingDto.approvalHistory` luôn rỗng; app đọc lịch sử duyệt từ `GET /api/bookingapprovals/booking/{id}`.
- `my-approvals` gộp theo nhóm và không trả cấp duyệt (`approvalStep` null).
- Chưa kiểm chứng: tìm người dùng (`GET /api/users?searchKeyword=`) có bỏ dấu không.
- Chưa kiểm chứng với Keycloak thật: client mobile bật *Direct access grants*; realm bật *Login with email* (app gửi `tên@domain` khi chọn domain, MSNV khi chọn "Mã nhân viên"); token có audience `account` (khi đăng nhập app xác nhận token bằng `GET …/realms/thacogroup/account`, không gọi back-end); token mang client role mà `Policy` của mỗi back-end yêu cầu: bưu phẩm `PARCEL_MANAGEMENT_WEB` (mặc định trong `docker-compose.yml`), phòng họp `BOOKING_ROOM_WEB` (staging `MEETING_ROOM_WEB`). Chạy back-end bưu phẩm local bằng `appsettings.json` thì `Policy:Url` / `Policy:Client` trống nên token SSO bị từ chối: cần đặt `Policy__Url=https://sso.thaco.com.vn/realms/thacogroup`, `Policy__Client` và `Policy__Roles__0` (`PARCEL_MANAGEMENT_WEB`).
