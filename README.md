# CB Pro Proxy

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen.svg)](https://github.com/yourusername/cbv-vpn-app)
[![Android Build](https://img.shields.io/badge/Android-Production%20Ready-success.svg)](https://github.com/yourusername/cbv-vpn-app)
[![iOS Build](https://img.shields.io/badge/iOS-In%20Development-orange.svg)](https://github.com/yourusername/cbv-vpn-app)
[![React Native](https://img.shields.io/badge/React%20Native-0.81.5-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-~54.0-000020.svg)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS-lightgrey.svg)](https://github.com/yourusername/cbv-vpn-app)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/yourusername/cbv-vpn-app/pulls)

**English documentation** — Vietnamese version available at [`README.vi.md`](./README.vi.md).

CB Pro Proxy is an Expo-managed React Native application that provisions a local VPN interface and forwards traffic through SOCKS5 or HTTP proxies. The Android implementation ships with a fully native `VpnService` pipeline while the iOS Network Extension layer is under active development.

## Product Overview

CB Pro Proxy revolutionizes proxy management on mobile devices by enabling seamless remote control through Android Debug Bridge (ADB). Tailored for developers, QA engineers, and automation specialists, this app allows you to create, start, and stop proxy profiles directly from your command line or scripts, making it perfect for device farming, automated testing, and CI/CD pipelines.

### Why ADB Control Matters

- **Automation-First Design**: Integrate proxy switching into your test suites and deployment scripts without touching the device.
- **Device Farm Ready**: Manage proxies across multiple Android devices simultaneously via ADB broadcasts.
- **No Manual Intervention**: Start VPN tunnels, add profiles, and monitor status remotely – ideal for headless environments.
- **Secure & Efficient**: Credentials are stored securely, and connections are handled natively for optimal performance.

Whether you're running Selenium tests, Appium scripts, or custom automation workflows, CB Pro Proxy bridges the gap between your development tools and mobile proxy needs.

---

## Screenshots

<p align="center">
  <img src="./screenshot/screen.png" alt="Main Screen" width="300" />
  <img src="./screenshot/screen-setting.png" alt="Settings Screen" width="300" />
</p>

---

## Key Features

### Core Features

- **Multi-profile proxy manager** — Create, update, and delete SOCKS5 or HTTP proxy profiles.
- **Native VPN tunnel** — Android foreground service with status bar notification and connection telemetry.
- **Credential security** — Metadata in `AsyncStorage`, secrets in `SecureStore` (Keychain on iOS).
- **Remote automation** — Full control via `adb` broadcast intents; designed for STF/device-farm workflows.
- **React Native UI** — Zustand-powered state management, modern screens, realtime connection stats.

### 🆕 New Features (v1.0)

- **Comprehensive Logging System** 🔍

  - Multi-level logging (debug, info, warn, error, critical)
  - Real-time log viewer with filtering and search
  - 30-day retention with automatic rotation
  - Export logs for debugging and support
  - Categorized logging (VPN, network, storage, UI, app)
  - [Learn more →](./docs/IMPLEMENTATION_GUIDE.md#logging-system)

- **Dark Mode** 🌙
  - Full theme system with light and dark modes
  - System theme detection (follows device settings)
  - WCAG AA compliant color contrast
  - AMOLED-optimized (true black backgrounds)
  - Smooth theme switching across all screens
  - [Learn more →](./docs/IMPLEMENTATION_GUIDE.md#dark-mode)

---

## Requirements

- Node.js 18+
- npm or Yarn Classic (Yarn Berry ≥2 requires `yarn add -D metro-minify-terser`)
- Expo CLI (`npx expo`)
- Android Studio (emulator, SDK platforms)
- Xcode (for upcoming iOS Network Extension work)

---

## Quick Start

```bash
# Clone & install
git clone <repository-url>
cd cbv-vpn-app
npm install

# Start Expo dev server
npm start

# Launch on Android (development build required)
npm run android

# Launch on iOS simulator (development build required)
npm run ios
```

> **Tip:** Use `npx expo run:android` / `npx expo run:ios` to generate native projects on demand.

---

## Project Structure

```
cbv-vpn-app/
├── src/
│   ├── components/            # Shared UI components (alerts, notifications, loaders, ...)
│   ├── screens/               # React Navigation screens (profiles, settings, logs)
│   ├── navigation/            # AppNavigator & stack/tab config
│   ├── services/              # Business logic (StorageService, CryptoService, ErrorHandler)
│   ├── store/                 # Zustand store (`vpnStore.ts`)
│   ├── hooks/                 # Hooks (`useVPNEvents`)
│   ├── native/                # JS bridge to native module (`VPNModule.ts`)
│   └── types/                 # Shared TypeScript definitions
├── android/                   # Native Android module & VpnService implementation
├── ios/                       # Placeholder for Network Extension (coming soon)
├── assets/                    # Icons & splash artwork
└── app.json / package.json    # Expo & dependency configuration
```

---

## Native Integration & ADB Control

Android exposes a broadcast receiver (`VPNIntentReceiver.kt`) with explicit intent actions:

- `com.cbv.vpn.ADD_PROFILE`
- `com.cbv.vpn.START_VPN_BY_NAME`
- `com.cbv.vpn.START_VPN_BY_ID`
- `com.cbv.vpn.STOP_VPN`
- `com.cbv.vpn.GET_STATUS`

Example intent sequence:

```bash
# Add or update a profile
adb shell am broadcast -n com.cbv.vpn/.VPNIntentReceiver \
  -a com.cbv.vpn.ADD_PROFILE \
  --es profile_name "My Proxy" \
  --es profile_host "203.0.113.10" \
  --ei profile_port 1080 \
  --es profile_type "socks5" \
  --es profile_username "user" \
  --es profile_password "secret"

# Start VPN by name (auto-stops previous session)
adb shell am broadcast -n com.cbv.vpn/.VPNIntentReceiver \
  -a com.cbv.vpn.START_VPN_BY_NAME \
  --es profile_name "My Proxy"

# Stop VPN
adb shell am broadcast -n com.cbv.vpn/.VPNIntentReceiver \
  -a com.cbv.vpn.STOP_VPN
```

See [`ADB_INTENT_COMMANDS.md`](./ADB_INTENT_COMMANDS.md) for the full catalogue, automation tips, and troubleshooting notes.

---

## Build for Production

### Android

```bash
npx expo prebuild --platform android
cd android
./gradlew assembleRelease     # Generate APK
./gradlew bundleRelease       # Generate AAB for Play Store
```

### iOS (in progress)

```bash
npx expo prebuild --platform ios
cd ios
open CBVVPN.xcworkspace       # Configure Network Extension in Xcode
```

---

## Architecture Overview

- **React Native layer** — UI, profile management workflow, Zustand store, event-driven updates through `useVPNEvents`.
- **Storage & security** — Profile metadata synced via `StorageService`, credentials isolated in secure storage.
- **Native Android** — `VPNConnectionService` (derives from `VpnService`), packet routing, proxy clients, explicit broadcast receiver for automation, foreground notification for compliance.
- **Native iOS** — Network Extension packet tunnel provider under construction; shares JS bridge contracts for parity.

---

## Development Status

- **Android**: production-ready (`VpnService`, SOCKS5/HTTP tunnelling, broadcast automation, telemetry).
- **iOS**: Network Extension + go-tun2socks integration scheduled.
- **Roadmap**: enhanced error analytics, multi-proxy rotation, UI polish.

Track ongoing work in `tasks.md` inside `.kiro/specs/` (private project planning).

---

## 📚 Documentation

Comprehensive documentation is available for all features:

### Getting Started

- **[Quick Start Guide](./docs/QUICK_START.md)** - Get up and running quickly
  - Installation steps
  - First launch guide
  - Feature overview
  - Troubleshooting

### Developer Guides

- **[Implementation Guide](./docs/IMPLEMENTATION_GUIDE.md)** - Technical documentation

  - Logging System API
  - Dark Mode API
  - Code examples
  - Best practices

- **[Feature Design Document](./docs/FEATURE_DESIGN.md)** - Architecture & design
  - System architecture
  - Data flow diagrams
  - Storage strategies
  - Performance considerations

### Testing

- **[Testing Guide](./docs/TESTING_GUIDE.md)** - Comprehensive test scenarios
  - Manual testing checklists
  - Feature validation
  - Performance testing
  - Known issues

### Additional Resources

- **[ADB Intent Commands](./ADB_INTENT_COMMANDS.md)** - Remote automation guide
- **[Contributing Guide](./CONTRIBUTING.md)** - How to contribute

---

## Troubleshooting Highlights

- **VPN permission dialog** — Android prompts the first time `VpnService.prepare()` returns an intent; automation flow opens the app if approval is pending.
- **Expo Go limitation** — Requires development client or production build due to custom native modules.
- **No traffic after connect** — Verify upstream proxy availability and credentials; inspect logcat with `adb logcat | grep VPN`.
- **Build issues** — Refer to [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) for common Gradle/Xcode remedies.

---

## License

MIT
