# CB Pro Proxy (Tiếng Việt)

> Phiên bản tiếng Việt của tài liệu CB Pro Proxy. Để xem bản tiếng Anh, hãy mở [README.md](./README.md).

CB Pro Proxy là ứng dụng React Native Expo đa nền tảng (Android và iOS) tạo kết nối VPN cục bộ và định tuyến lưu lượng truy cập qua proxy SOCKS5/HTTP.

## Tính năng

- ✅ Quản lý nhiều proxy profile (SOCKS5 và HTTP)
- ✅ Kết nối VPN với biểu tượng trên thanh trạng thái
- ✅ Hỗ trợ xác thực proxy (username/password)
- ✅ Điều khiển từ xa qua ADB intents (Android)
- ✅ Lưu trữ an toàn credentials
- 🚧 Hỗ trợ iOS Network Extension (đang phát triển)

## Yêu cầu

- Node.js 18+
- npm hoặc yarn (khuyến nghị npm hoặc Yarn Classic v1)
- Expo CLI
- Android Studio (cho Android development)
- Xcode (cho iOS development)

**Lưu ý**: Nếu sử dụng Yarn Berry (v2+), cần cài thêm: `yarn add -D metro-minify-terser`

## Cài đặt

```bash
# Clone repository
git clone <repository-url>
cd cbv-vpn-app

# Cài đặt dependencies
npm install

# Chạy development server
npm start

# Chạy trên Android (yêu cầu development build)
npm run android

# Chạy trên iOS (yêu cầu development build)
npm run ios
```

## Cấu trúc dự án

```
cbv-vpn-app/
├── src/
│   ├── components/         # React components
│   ├── screens/            # Screen components
│   │   ├── ProfileListScreen.tsx
│   │   ├── ProfileFormScreen.tsx
│   │   └── ConnectionScreen.tsx
│   ├── navigation/         # React Navigation setup
│   ├── services/           # Business logic services
│   │   ├── StorageService.ts
│   │   └── CryptoService.ts
│   ├── store/             # Zustand state management
│   ├── types/             # TypeScript type definitions
│   ├── native/            # Native module bridges
│   │   └── VPNModule.ts
│   └── hooks/             # Custom React hooks
├── android/               # Android native code
│   └── app/src/main/java/com/cbv/vpn/
│       ├── VPNModule.kt
│       ├── VPNPackage.kt
│       ├── VPNConnectionService.kt
│       └── VPNIntentReceiver.kt
├── ios/                   # iOS native code (coming soon)
└── app.json              # Expo configuration
```

## Build cho Production

### Android

```bash
# Generate Android project
npx expo prebuild --platform android

# Build APK
cd android
./gradlew assembleRelease

# Build AAB (cho Google Play Store)
./gradlew bundleRelease
```

### iOS

```bash
# Generate iOS project
npx expo prebuild --platform ios

# Open trong Xcode
cd ios
open CBVVPNApp.xcworkspace
```

## ADB Commands (Android)

Điều khiển VPN qua ADB intents:

```bash
# Thêm VPN profile
adb shell am broadcast \
  -a com.cbv.vpn.ADD_PROFILE \
  --es profile_name "My VPN" \
  --es profile_host "192.168.1.100" \
  --ei profile_port 1080 \
  --es profile_type "socks5"

# Kích hoạt VPN bằng tên profile
adb shell am broadcast \
  -a com.cbv.vpn.START_VPN_BY_NAME \
  --es profile_name "My VPN"

# Kích hoạt VPN bằng ID profile
adb shell am broadcast \
  -a com.cbv.vpn.START_VPN_BY_ID \
  --es profile_id "1699876543210"

# Dừng VPN
adb shell am broadcast -a com.cbv.vpn.STOP_VPN

# Kiểm tra trạng thái
adb shell am broadcast -a com.cbv.vpn.GET_STATUS
```

Xem thêm ví dụ trong `ADB_INTENT_COMMANDS.md`.

## Kiến trúc

- **React Native Layer**: UI, Zustand state, AsyncStorage + SecureStore
- **Native Android**: VPNModule, VPNConnectionService, xử lý gói tin, tích hợp proxy
- **Native iOS**: Network Extension (đang phát triển)

## Bảo mật

- Credentials lưu trong SecureStore/Keychain
- Metadata và credentials tách biệt
- Hỗ trợ cập nhật/lưu trữ thông qua native bridge

## Trạng thái phát triển

- Android: Hoàn tất ✅
- iOS: Đang xây dựng 🚧

## Lisence

MIT
