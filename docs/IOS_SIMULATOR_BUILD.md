# iOS Simulator Build Guide

Build CB Pro Proxy for iOS Simulator **without Apple Developer account**.

Perfect for:
- ✅ CI/CD testing
- ✅ Unit tests
- ✅ Snapshot tests
- ✅ Development testing
- ✅ Demo purposes

**No certificates, no provisioning profiles, no signing required!**

---

## Quick Start

### Option 1: Automated Script (Recommended)

```bash
# Build for simulator (one command!)
./scripts/build-simulator.sh

# Install on simulator
cd ios/build/simulator-dist
./install.sh
```

### Option 2: Manual Build

```bash
# 1. Prebuild if needed
npx expo prebuild --platform ios

# 2. Install dependencies
cd ios && pod install && cd ..

# 3. Build for simulator
cd ios
xcodebuild \
  -workspace CBVVPN.xcworkspace \
  -scheme CBVVPN \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 15,OS=latest' \
  -derivedDataPath ./build \
  clean build \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGNING_ALLOWED=NO

# 4. Install on simulator
xcrun simctl install booted CBVVPN.app
```

---

## GitHub Actions CI/CD

The project includes a workflow for automatic simulator builds.

### Workflow File

`.github/workflows/build-ios-simulator.yml`

### Triggers

```yaml
# Automatic on push
git push origin main

# Automatic on pull request
# (creates PR and it triggers automatically)

# Manual trigger
# Go to Actions tab → Build iOS Simulator → Run workflow
```

### Features

- ✅ Builds on macOS 14 with Xcode 15.4
- ✅ No secrets required
- ✅ Creates .app bundle
- ✅ Uploads artifact (30 days retention)
- ✅ Runs unit tests (optional)
- ✅ Multi-simulator matrix build (manual trigger)

### Download Artifact

1. Go to **Actions** tab on GitHub
2. Click on the workflow run
3. Download **CBVVPN-Simulator-{sha}.zip**
4. Unzip and follow README.txt

---

## Local Development

### Prerequisites

- macOS with Xcode 15.4+
- Node.js 18+
- CocoaPods

### Build Steps

#### 1. Build with Script

```bash
# Automated build
./scripts/build-simulator.sh
```

The script will:
- ✅ Check prerequisites
- ✅ Run expo prebuild if needed
- ✅ Install CocoaPods
- ✅ Build for simulator
- ✅ Create distribution archive
- ✅ Generate install script

#### 2. Manual Build

```bash
# Ensure iOS project exists
npx expo prebuild --platform ios

# Install pods
cd ios
pod install

# Build
xcodebuild \
  -workspace CBVVPN.xcworkspace \
  -scheme CBVVPN \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 15,OS=latest' \
  clean build \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGNING_ALLOWED=NO
```

---

## Installation on Simulator

### Method 1: Quick Install Script

```bash
cd ios/build/simulator-dist
./install.sh
```

This script will:
1. Check if simulator is running
2. Boot iPhone 15 if no simulator running
3. Install the app
4. Show launch command

### Method 2: Drag & Drop (GUI)

1. Open Xcode
2. **Window → Devices and Simulators** (⇧⌘2)
3. Select **iOS Simulators** tab
4. Select a simulator
5. Drag **CBVVPN.app** onto the simulator

### Method 3: Command Line

```bash
# Boot a simulator
open -a Simulator
# or
xcrun simctl boot "iPhone 15"

# Install app
xcrun simctl install booted CBVVPN.app

# Launch app
xcrun simctl launch booted com.cbv.vpn
```

---

## Working with Simulators

### List Available Simulators

```bash
# List all simulators
xcrun simctl list devices

# List only booted simulators
xcrun simctl list devices | grep Booted

# List by iOS version
xcrun simctl list devices | grep "iOS 17"
```

### Boot/Shutdown Simulators

```bash
# Boot specific simulator
xcrun simctl boot "iPhone 15"
xcrun simctl boot "iPad Pro (12.9-inch)"

# Shutdown
xcrun simctl shutdown all
xcrun simctl shutdown "iPhone 15"

# Erase (factory reset)
xcrun simctl erase "iPhone 15"
```

### Install/Uninstall Apps

```bash
# Install
xcrun simctl install booted CBVVPN.app
xcrun simctl install "iPhone 15" CBVVPN.app

# Uninstall
xcrun simctl uninstall booted com.cbv.vpn

# List installed apps
xcrun simctl listapps booted
```

### Launch Apps

```bash
# Launch
xcrun simctl launch booted com.cbv.vpn

# Launch with console output
xcrun simctl launch --console booted com.cbv.vpn

# Terminate
xcrun simctl terminate booted com.cbv.vpn
```

---

## Testing & Debugging

### View Logs

```bash
# Stream app logs
xcrun simctl spawn booted log stream --predicate 'process == "CBVVPN"'

# View all logs
xcrun simctl spawn booted log stream

# Filter by level
xcrun simctl spawn booted log stream --level debug
```

### Run Unit Tests

```bash
cd ios

xcodebuild test \
  -workspace CBVVPN.xcworkspace \
  -scheme CBVVPN \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 15,OS=latest' \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGNING_ALLOWED=NO
```

### Take Screenshots

```bash
# Take screenshot
xcrun simctl io booted screenshot screenshot.png

# Record video
xcrun simctl io booted recordVideo --codec h264 video.mp4
# Press Ctrl+C to stop recording
```

### Push Notifications (Testing)

```bash
# Create notification payload
cat > notification.json << 'EOF'
{
  "aps": {
    "alert": "Test notification",
    "sound": "default"
  }
}
EOF

# Send notification
xcrun simctl push booted com.cbv.vpn notification.json
```

---

## Build Configurations

### Debug vs Release

```bash
# Debug build (default)
xcodebuild -configuration Debug ...

# Release build (optimized)
xcodebuild -configuration Release ...
```

### Different Simulators

```bash
# iPhone 15
-destination 'platform=iOS Simulator,name=iPhone 15,OS=latest'

# iPhone 14
-destination 'platform=iOS Simulator,name=iPhone 14,OS=17.2'

# iPad Pro
-destination 'platform=iOS Simulator,name=iPad Pro (12.9-inch),OS=latest'

# Build for all available
xcodebuild -showdestinations \
  -workspace CBVVPN.xcworkspace \
  -scheme CBVVPN
```

### Multiple Architectures

Simulator builds automatically include:
- `x86_64` - Intel Macs
- `arm64` - Apple Silicon (M1/M2/M3)

The build system handles this automatically.

---

## Troubleshooting

### Build Fails: "No such module 'React'"

**Solution:** Install CocoaPods
```bash
cd ios
pod install
```

### Build Fails: "Unable to boot device"

**Solution:** Reset simulator
```bash
xcrun simctl shutdown all
xcrun simctl erase all
xcrun simctl boot "iPhone 15"
```

### App Doesn't Launch

**Solution:** Check logs
```bash
xcrun simctl spawn booted log stream --predicate 'process == "CBVVPN"'
```

### Network Extension Not Working

**Known Limitation:** Network Extension has limited functionality in simulator.

For full testing, use physical device:
- See `.github/workflows/build-ios.yml` for device builds
- Requires Apple Developer account

### "Command not found: xcrun"

**Solution:** Install Xcode Command Line Tools
```bash
xcode-select --install
```

### Multiple Xcode Versions

```bash
# List installed Xcode versions
ls /Applications | grep Xcode

# Select active Xcode
sudo xcode-select -s /Applications/Xcode.app

# Verify
xcodebuild -version
```

---

## CI/CD Integration

### GitHub Actions

Already configured! See `.github/workflows/build-ios-simulator.yml`

**Triggers:**
- Push to `main` or `develop`
- Pull requests
- Manual workflow dispatch

**Artifacts:**
- Automatic upload to GitHub Actions
- 30 days retention
- Download from Actions tab

### Local CI Testing

```bash
# Mimic CI build locally
./scripts/build-simulator.sh

# Verify outputs
ls -lh ios/build/CBVVPN-Simulator.zip
```

---

## Comparison: Simulator vs Device

| Feature | Simulator Build | Device Build |
|---------|----------------|--------------|
| **Apple Developer** | ❌ Not required | ✅ Required |
| **Code Signing** | ❌ Not required | ✅ Required |
| **Certificates** | ❌ Not required | ✅ Required |
| **Provisioning** | ❌ Not required | ✅ Required |
| **Installation** | Simulator only | Physical devices |
| **Network Extension** | ⚠️ Limited | ✅ Full support |
| **CI/CD** | ✅ Easy | ⚠️ Needs secrets |
| **Testing** | ✅ Perfect | ✅ Real-world |
| **Distribution** | Developer only | TestFlight, App Store |

---

## Best Practices

### For Development

1. ✅ Use simulator builds for rapid testing
2. ✅ Test on multiple simulator versions
3. ✅ Use physical device for final testing
4. ✅ Test Network Extension on real device

### For CI/CD

1. ✅ Run simulator builds on every PR
2. ✅ Run unit tests automatically
3. ✅ Use device builds for releases
4. ✅ Keep artifacts for debugging

### For Testing

1. ✅ Simulator: UI tests, unit tests
2. ✅ Device: Integration tests, real proxy testing
3. ✅ Both: Regression testing

---

## Advanced Usage

### Custom Build Script

```bash
#!/bin/bash
# custom-build.sh

SIMULATOR="iPhone 15"
SCHEME="CBVVPN"

xcodebuild \
  -workspace ios/CBVVPN.xcworkspace \
  -scheme "$SCHEME" \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination "platform=iOS Simulator,name=$SIMULATOR,OS=latest" \
  clean build \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGNING_ALLOWED=NO

echo "Build complete for $SIMULATOR"
```

### Automated Testing Script

```bash
#!/bin/bash
# test-all-simulators.sh

SIMULATORS=("iPhone 15" "iPhone 14" "iPad Pro (12.9-inch)")

for SIM in "${SIMULATORS[@]}"; do
  echo "Testing on $SIM..."

  xcodebuild test \
    -workspace ios/CBVVPN.xcworkspace \
    -scheme CBVVPN \
    -sdk iphonesimulator \
    -destination "platform=iOS Simulator,name=$SIM,OS=latest" \
    CODE_SIGN_IDENTITY="" \
    CODE_SIGNING_REQUIRED=NO
done
```

---

## Resources

- [Xcode Simulator Documentation](https://developer.apple.com/documentation/xcode/running-your-app-in-simulator-or-on-a-device)
- [simctl Command Reference](https://developer.apple.com/library/archive/documentation/IDEs/Conceptual/iOS_Simulator_Guide/InteractingwiththeiOSSimulator/InteractingwiththeiOSSimulator.html)
- [GitHub Actions macOS Runners](https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners)

---

## Summary

```bash
# TL;DR - Build for simulator

# Automated (recommended)
./scripts/build-simulator.sh

# Install
cd ios/build/simulator-dist && ./install.sh

# Launch
xcrun simctl launch booted com.cbv.vpn

# View logs
xcrun simctl spawn booted log stream --predicate 'process == "CBVVPN"'
```

**Benefits:**
- ✅ No Apple Developer account
- ✅ No code signing hassles
- ✅ Perfect for CI/CD
- ✅ Fast iteration
- ✅ Easy testing

**Limitations:**
- ⚠️ Simulator only (not on physical devices)
- ⚠️ Network Extension has limited support
- ⚠️ Some hardware features unavailable

Happy testing! 🚀
