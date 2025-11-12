# Expo Prebuild Guide for CB Pro Proxy

This guide explains how to use Expo prebuild with CB Pro Proxy's native VPN modules.

## Overview

CB Pro Proxy uses **Expo managed workflow with native modules**. The native iOS and Android VPN code is integrated using:

1. **Expo Config Plugin** (`plugins/withVPNModule.js`) - Automatically configures native projects
2. **Expo Prebuild** - Generates native iOS and Android projects with your native code
3. **Custom Native Modules** - VPN functionality written in Swift (iOS) and Kotlin (Android)

## Quick Start

```bash
# Install dependencies
npm install

# Generate native projects (iOS + Android)
npx expo prebuild

# Run on device
npm run ios     # For iOS
npm run android # For Android
```

## Detailed Steps

### 1. Install Dependencies

```bash
npm install
```

This installs all React Native and Expo dependencies, including the config plugin dependencies.

### 2. Prebuild for Android

```bash
# Generate Android project only
npx expo prebuild --platform android

# OR clean prebuild (removes existing android folder first)
npx expo prebuild --platform android --clean
```

**What happens:**
- ✅ Creates `android/` directory with native project
- ✅ Copies VPN native modules (Kotlin files)
- ✅ Configures `AndroidManifest.xml` with VPN permissions
- ✅ Adds VPNPackage to MainApplication.kt
- ✅ Ready to build!

**Build Android APK:**
```bash
cd android
./gradlew assembleRelease
```

### 3. Prebuild for iOS

```bash
# Generate iOS project only
npx expo prebuild --platform ios

# OR clean prebuild
npx expo prebuild --platform ios --clean
```

**What happens:**
- ✅ Creates `ios/` directory with native project
- ✅ Copies VPN native modules (Swift files)
- ✅ Configures entitlements with Network Extensions
- ✅ Updates Info.plist with background modes
- ✅ Updates bridging header for React Native
- ⚠️ **Manual step required:** Add Network Extension target in Xcode

**After prebuild, configure Xcode:**
```bash
cd ios

# Run configuration helper
./configure-network-extension.sh

# Open Xcode
open CBVVPN.xcworkspace
```

Follow the instructions in:
- `ios/XCODE_SETUP_REQUIRED.md` - Complete setup guide
- `ios/iOS_PROXY_IMPLEMENTATION.md` - Technical details

### 4. Clean Prebuild (Fresh Start)

If you need to regenerate native projects from scratch:

```bash
# Remove existing native projects
rm -rf ios android

# Regenerate both platforms
npx expo prebuild --clean

# OR one platform at a time
npx expo prebuild --platform ios --clean
npx expo prebuild --platform android --clean
```

## Config Plugin Explained

The Expo config plugin (`plugins/withVPNModule.js`) automatically:

### Android Configuration

1. ✅ Adds VPNPackage to MainApplication.kt
2. ✅ Ensures native VPN modules are in correct directory
3. ✅ Configures AndroidManifest.xml permissions

### iOS Configuration

1. ✅ Adds Network Extensions entitlement
2. ✅ Adds App Groups entitlement (group.com.cbv.vpn)
3. ✅ Configures background modes (network-authentication)
4. ✅ Updates bridging header with React Native imports
5. ⚠️ Note: Network Extension target must be added manually in Xcode

## Development Workflow

### Option 1: Expo Dev Client (Recommended)

```bash
# Build dev client once
npx expo run:ios    # Installs on iOS device/simulator
npx expo run:android # Installs on Android device/emulator

# Then use Expo dev server for hot reloading
npm start

# Press 'i' for iOS, 'a' for Android
```

Benefits:
- ✅ Fast refresh / hot reload
- ✅ Native modules work
- ✅ Debug JS code
- ✅ No need to rebuild for JS changes

### Option 2: Direct Native Build

```bash
# iOS
cd ios
pod install
xcodebuild -workspace CBVVPN.xcworkspace -scheme CBVVPN

# Android
cd android
./gradlew assembleDebug
```

## When to Prebuild

You need to run `npx expo prebuild` when:

1. ✅ **First time setup** - Generate native projects
2. ✅ **After updating native code** - VPN modules changed
3. ✅ **After changing app.json** - Bundle ID, permissions, etc.
4. ✅ **After adding/removing plugins** - Config plugin changes
5. ✅ **Clean state needed** - Use `--clean` flag

You DON'T need to prebuild for:
- ❌ JavaScript/TypeScript code changes
- ❌ React component updates
- ❌ Zustand store changes
- ❌ Regular app development

## Native Module Development

### Modifying Android VPN Code

```bash
# 1. Edit Kotlin files in android/app/src/main/java/com/cbv/vpn/
vim android/app/src/main/java/com/cbv/vpn/VPNModule.kt

# 2. Rebuild
cd android
./gradlew assembleDebug

# 3. Install on device
./gradlew installDebug
```

### Modifying iOS VPN Code

```bash
# 1. Edit Swift files in ios/CBVVPN/
vim ios/CBVVPN/VPNModule.swift

# 2. Open in Xcode
cd ios
open CBVVPN.xcworkspace

# 3. Build and run in Xcode (⌘R)
```

## Troubleshooting

### "Expo Go not supported"

**Problem:** Native modules don't work in Expo Go app

**Solution:** Use development build instead
```bash
npx expo run:ios    # Creates dev client
npx expo run:android
```

### "Native project not found"

**Problem:** `ios/` or `android/` directory missing

**Solution:** Run prebuild
```bash
npx expo prebuild
```

### "VPN module not found"

**Problem:** Native module not linking correctly

**Solution:** Clean prebuild
```bash
npx expo prebuild --clean
cd ios && pod install  # iOS only
```

### "Build failed after prebuild"

**Problem:** Android Gradle or iOS CocoaPods errors

**Solution:** Install dependencies
```bash
# Android - usually no extra steps needed

# iOS - install pods
cd ios
pod install
cd ..
```

### "Network Extension not working on iOS"

**Problem:** VPN connection fails, no traffic routing

**Solution:**
1. Network Extension target must be configured in Xcode
2. Run `ios/configure-network-extension.sh` for checklist
3. See `ios/XCODE_SETUP_REQUIRED.md` for detailed steps
4. Must test on **physical device** (Simulator has limited support)

## CI/CD with GitHub Actions

See `.github/workflows/build-android.yml` and `.github/workflows/build-ios.yml`

The workflows automatically:
1. ✅ Run `npx expo prebuild`
2. ✅ Build release APK/IPA
3. ✅ Upload artifacts
4. ✅ Create GitHub releases for tags

Secrets required:
- See `.github/SECRETS.md` for complete list
- Android: Keystore and signing credentials
- iOS: Certificates and provisioning profiles

## Directory Structure After Prebuild

```
CB-Pro-Proxy/
├── android/                    # Generated by prebuild
│   ├── app/
│   │   └── src/main/java/com/cbv/vpn/
│   │       ├── VPNModule.kt    # Auto-copied
│   │       ├── VPNConnectionService.kt
│   │       └── ...
│   └── ...
│
├── ios/                        # Generated by prebuild
│   ├── CBVVPN/
│   │   ├── VPNModule.swift     # Already present
│   │   ├── VPNManager.swift
│   │   └── ...
│   ├── PacketTunnel/
│   │   ├── PacketTunnelProvider.swift
│   │   └── ...
│   └── CBVVPN.xcworkspace
│
├── plugins/
│   └── withVPNModule.js        # Expo config plugin
│
├── src/                        # React Native JS/TS code
│   └── native/
│       └── VPNModule.ts        # JS bridge interface
│
└── app.json                    # Expo configuration
```

## Best Practices

### 1. Version Control

**Commit to git:**
- ✅ `plugins/withVPNModule.js`
- ✅ `app.json`
- ✅ `package.json`
- ✅ Native source files (`ios/CBVVPN/*.swift`, etc.)

**Add to .gitignore:**
- ❌ `ios/Pods/`
- ❌ `ios/build/`
- ❌ `android/build/`
- ❌ `android/.gradle/`

**Optional (your choice):**
- `ios/` and `android/` directories (can be regenerated)
- Many teams gitignore these and regenerate via prebuild

### 2. Team Workflow

```bash
# New team member setup
git clone <repository>
npm install
npx expo prebuild

# iOS additional step
cd ios && pod install

# Ready to develop!
npm start
```

### 3. Updating Dependencies

```bash
# Update Expo SDK
npm install expo@latest

# Update all Expo packages
npx expo install --fix

# Regenerate native projects
npx expo prebuild --clean
```

## Resources

- [Expo Prebuild Docs](https://docs.expo.dev/workflow/prebuild/)
- [Expo Config Plugins](https://docs.expo.dev/config-plugins/introduction/)
- [Continuous Native Generation (CNG)](https://docs.expo.dev/workflow/continuous-native-generation/)
- [React Native iOS Guide](https://reactnative.dev/docs/native-modules-ios)
- [React Native Android Guide](https://reactnative.dev/docs/native-modules-android)

## Getting Help

1. Check `ios/XCODE_SETUP_REQUIRED.md` for iOS-specific issues
2. Check `ios/iOS_PROXY_IMPLEMENTATION.md` for technical details
3. Check `.github/SECRETS.md` for CI/CD setup
4. Review Expo documentation for prebuild issues
5. Open an issue on GitHub

## Summary

```bash
# TL;DR - Complete setup
npm install
npx expo prebuild
cd ios && pod install && cd ..
npm run ios    # or npm run android

# For iOS: Configure Network Extension in Xcode
cd ios
./configure-network-extension.sh
open CBVVPN.xcworkspace
# Follow ios/XCODE_SETUP_REQUIRED.md
```

Happy coding! 🚀
