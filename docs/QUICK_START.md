# Quick Start Guide

**CB-Pro-Proxy - Getting Started with Logging & Dark Mode**  
**Version:** 1.0  
**Last Updated:** 2025-01-14

This guide will help you quickly get started with CB-Pro-Proxy's new Logging System and Dark Mode features.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [First Launch](#first-launch)
4. [Using Dark Mode](#using-dark-mode)
5. [Using the Logging System](#using-the-logging-system)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

**For Development:**

- Node.js 18 or higher
- npm or Yarn
- React Native development environment
- Android Studio (for Android) or Xcode (for iOS)

**For Running the App:**

- Android 5.0 (API 21) or higher
- iOS 13.0 or higher (when available)

### Knowledge Prerequisites

Basic familiarity with:

- React Native applications
- VPN concepts
- Mobile app navigation

---

## Installation

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd CB-Pro-Proxy
```

### Step 2: Install Dependencies

```bash
# Using npm
npm install

# Using Yarn
yarn install
```

### Step 3: Install iOS Dependencies (iOS only)

```bash
cd ios
pod install
cd ..
```

### Step 4: Verify Installation

```bash
# Check if all dependencies are installed
npm list

# Verify React Native setup
npx react-native doctor
```

---

## Running the App

### Development Mode

**Start Metro Bundler:**

```bash
npm start
# or
yarn start
```

**Run on Android:**

```bash
# With connected device or running emulator
npm run android
# or
yarn android
```

**Run on iOS:**

```bash
# With running simulator or connected device
npm run ios
# or
yarn ios
```

### Production Build

**Android APK:**

```bash
cd android
./gradlew assembleRelease
# APK location: android/app/build/outputs/apk/release/app-release.apk
```

**Android Bundle (for Play Store):**

```bash
cd android
./gradlew bundleRelease
# AAB location: android/app/build/outputs/bundle/release/app-release.aab
```

**iOS (requires Xcode):**

```bash
cd ios
open CBVVPN.xcworkspace
# Build in Xcode: Product > Archive
```

---

## First Launch

### Initial Setup

1. **Launch the App**

   - Open CB-Pro-Proxy on your device
   - Grant necessary permissions when prompted

2. **Check Default Settings**

   - The app starts in Light mode by default (or System mode if configured)
   - Logging is enabled by default

3. **Create Your First Profile** (if needed)
   - Navigate to Profiles screen
   - Tap "Add Profile"
   - Enter proxy details
   - Save profile

### Verify Features

**Check Logging:**

1. Navigate to Logs screen (via menu)
2. You should see initial app logs
3. Expected logs: "App initialized", "Storage loaded", etc.

**Check Dark Mode:**

1. Go to Settings screen
2. Look for "Appearance" or "Theme" section
3. Try switching themes
4. UI should update immediately

---

## Using Dark Mode

### Accessing Theme Settings

1. **Open Settings**

   - Tap on Settings tab in bottom navigation
   - Or navigate via menu

2. **Locate Appearance Section**
   - Scroll to "Appearance" section
   - You'll see theme options

### Changing Theme

**Option 1: Settings Screen**

```
Settings → Appearance → Theme
```

Choose from:

- **Light**: Always light theme
- **Dark**: Always dark theme
- **System**: Follow device settings

**Option 2: Quick Toggle** (if available)

Some screens may have a quick theme toggle button (usually moon/sun icon).

### Theme Modes Explained

**Light Mode**

- Bright backgrounds
- Dark text
- Optimized for daylight viewing
- Lower battery usage on LCD screens

**Dark Mode**

- Dark/black backgrounds
- Light text
- Reduced eye strain in low light
- Better battery on AMOLED screens
- True black (#000000) background

**System Mode**

- Follows your device's theme setting
- Changes automatically with device
- Best for adaptive usage patterns

### Customizing Your Experience

**When to Use Light Mode:**

- Outdoor/bright environments
- Daytime use
- Better visibility in sunlight

**When to Use Dark Mode:**

- Evening/night use
- Low-light environments
- Battery conservation (AMOLED)
- Reduced eye strain

**When to Use System Mode:**

- Automatic adaptation
- Matches device aesthetic
- Changes with time of day (if device does)

---

## Using the Logging System

### Accessing Logs

**Method 1: Bottom Navigation**

1. Tap "Logs" tab in bottom navigation bar

**Method 2: Settings Menu**

1. Go to Settings
2. Tap "View Logs" (if available)

### Understanding the Logs Screen

**Screen Layout:**

```
┌─────────────────────────────────────┐
│ Logs        [Export] [Clear]        │ ← Header
├─────────────────────────────────────┤
│ [Search logs...]                    │ ← Search bar
├─────────────────────────────────────┤
│ Level: [ALL] [INFO] [WARN] [ERROR] │ ← Level filter
├─────────────────────────────────────┤
│ Category: [ALL] [VPN] [UI] [...]   │ ← Category filter
├─────────────────────────────────────┤
│ Showing 15 of 47 logs               │ ← Stats
├─────────────────────────────────────┤
│ 🟢 INFO  12:34:56  vpn              │
│ VPN connected successfully          │ ← Log entries
├─────────────────────────────────────┤
│ 🔴 ERROR 12:35:12  network          │
│ Connection timeout                  │
└─────────────────────────────────────┘
```

### Filtering Logs

**By Level:**

- Tap level buttons: ALL, DEBUG, INFO, WARN, ERROR, CRITICAL
- Active filter is highlighted
- Shows only matching log levels

**By Category:**

- Tap category buttons: ALL, APP, VPN, NETWORK, STORAGE, UI
- Filters logs by functional area
- Can combine with level filters

**By Search:**

- Type in search box
- Searches message content
- Case-insensitive
- Real-time filtering

### Reading Log Entries

**Log Entry Format:**

```
🟢 INFO    12:34:56    vpn
VPN connected successfully
Profile: Home Proxy
```

**Components:**

- **Level Badge**: Color-coded severity indicator
- **Timestamp**: When the event occurred
- **Category**: Functional area of the log
- **Message**: Human-readable description
- **Data**: Additional context (expandable)

**Level Colors:**

- 🟢 **DEBUG**: Gray (detailed info)
- 🔵 **INFO**: Blue (general info)
- 🟡 **WARN**: Yellow (warnings)
- 🔴 **ERROR**: Red (errors)
- ⚫ **CRITICAL**: Dark red (critical issues)

### Exporting Logs

**When to Export:**

- Reporting bugs
- Sharing with support
- Analyzing issues
- Backup purposes

**How to Export:**

1. **Optional: Apply Filters**

   - Filter to specific time range
   - Filter to specific log level or category
   - Only filtered logs will be exported

2. **Tap Export Button**

   - Located in header (top-right)

3. **Choose Destination**

   - Email
   - Save to Files
   - Share to other apps
   - AirDrop (iOS)

4. **File Format**
   - Exports as JSON
   - Includes all log data
   - Timestamp, level, category, message, metadata

**Export Example:**

```json
[
  {
    "id": "uuid-here",
    "timestamp": 1705190400000,
    "level": "info",
    "category": "vpn",
    "message": "VPN connected successfully",
    "data": {
      "profileId": "profile-123",
      "profileName": "Home Proxy"
    }
  }
]
```

### Clearing Logs

**When to Clear:**

- Logs taking too much space
- Starting fresh debugging session
- Privacy concerns

**How to Clear:**

1. Tap "Clear" button (top-right)
2. Confirm deletion in dialog
3. All logs will be removed
4. Action cannot be undone

**Note**: Clearing logs removes them permanently from both memory and storage.

### Common Log Categories

**VPN Logs** (`vpn`):

- Connection events
- Status changes
- Profile operations
- Native module events

**Network Logs** (`network`):

- HTTP requests
- Proxy operations
- Network errors
- Timeout events

**Storage Logs** (`storage`):

- Profile save/load
- Settings persistence
- Cache operations
- Database operations

**UI Logs** (`ui`):

- Screen navigation
- Button presses
- User interactions
- Form submissions

**App Logs** (`app`):

- App lifecycle
- Initialization
- Background/foreground
- App updates

---

## Troubleshooting

### Logging Issues

#### Logs Not Appearing

**Problem**: Logs screen is empty or logs don't update.

**Solutions**:

1. Check if logging is enabled in settings
2. Perform some actions to generate logs
3. Pull to refresh (if implemented)
4. Restart the app

#### Cannot Export Logs

**Problem**: Export button doesn't work or share fails.

**Solutions**:

1. Check storage permissions
2. Try different share destination
3. Check if logs are empty
4. Verify device has available storage

#### Logs Taking Too Much Space

**Problem**: App storage growing too large.

**Solutions**:

1. Clear old logs manually
2. Reduce log retention period (if configurable)
3. Disable debug logging
4. Export and clear regularly

### Dark Mode Issues

#### Theme Not Switching

**Problem**: Theme doesn't change when selected.

**Solutions**:

1. Force close and restart app
2. Check AsyncStorage permissions
3. Reset app data (will lose settings)
4. Reinstall app

#### Theme Doesn't Follow System

**Problem**: System mode not detecting device theme.

**Solutions**:

1. Verify "System" mode is selected
2. Check device theme settings are correct
3. Restart app after changing device theme
4. Grant app permissions if requested

#### Colors Look Wrong

**Problem**: Text is unreadable or colors seem off.

**Solutions**:

1. Verify correct theme is active
2. Check device display settings (color filters, etc.)
3. Update app to latest version
4. Report issue with screenshots

### Performance Issues

#### App Feels Slow

**Problem**: UI lag or stuttering.

**Solutions**:

1. Clear logs (may have too many entries)
2. Disable debug logging
3. Restart app
4. Check device resources

#### High Battery Usage

**Problem**: App draining battery quickly.

**Solutions**:

1. Use dark mode on AMOLED screens
2. Reduce logging frequency
3. Disable persistent logging
4. Check for background processes

### General Issues

#### App Crashes

**Problem**: App closes unexpectedly.

**Solutions**:

1. Check logs before crash (if possible)
2. Export logs for debugging
3. Clear app cache
4. Reinstall app
5. Report to support with logs

#### Settings Not Saving

**Problem**: Theme or log settings reset on restart.

**Solutions**:

1. Check storage permissions
2. Ensure AsyncStorage is working
3. Don't force close immediately after changing
4. Check device storage space

---

## Feature Access Quick Reference

### Quick Actions

| Feature      | How to Access                    |
| ------------ | -------------------------------- |
| View Logs    | Bottom navigation → Logs tab     |
| Change Theme | Settings → Appearance → Theme    |
| Filter Logs  | Logs screen → Tap filter buttons |
| Search Logs  | Logs screen → Type in search box |
| Export Logs  | Logs screen → Export button      |
| Clear Logs   | Logs screen → Clear button       |

### Keyboard Shortcuts (Development)

When using React Native development builds:

- **⌘R** (iOS) / **RR** (Android): Reload app
- **⌘D** (iOS) / **⌘M** (Android): Dev menu

---

## Next Steps

Now that you're familiar with the basics:

1. **Read the Implementation Guide**

   - [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)
   - Learn about APIs and advanced usage
   - Understand architecture

2. **Review the Testing Guide**

   - [TESTING_GUIDE.md](./TESTING_GUIDE.md)
   - Comprehensive test scenarios
   - Known issues and limitations

3. **Explore the Feature Design**

   - [FEATURE_DESIGN.md](./FEATURE_DESIGN.md)
   - Detailed technical specifications
   - Architecture diagrams

4. **Check the Main README**
   - [README.md](../README.md)
   - Project overview
   - Contributing guidelines

---

## Getting Help

### Documentation

- **Implementation Guide**: Technical details and API reference
- **Testing Guide**: Testing procedures and checklists
- **Feature Design**: Architecture and specifications

### Support Channels

1. **GitHub Issues**: Report bugs or request features
2. **Documentation**: Check guides and examples
3. **Code Comments**: Read inline documentation

### Reporting Issues

When reporting issues, include:

- Device and OS version
- App version
- Steps to reproduce
- Screenshots (if applicable)
- **Exported logs** (very helpful!)

---

## FAQ

**Q: Do I need to configure anything after installation?**  
A: No, both features work out of the box. Default settings are suitable for most users.

**Q: Will logging impact performance?**  
A: Minimal impact. Logging is optimized and asynchronous. Debug logs can be disabled in production.

**Q: Can I customize the theme colors?**  
A: Not in the UI currently, but developers can modify theme files. See Implementation Guide.

**Q: How long are logs kept?**  
A: Logs are kept for 30 days by default, with automatic cleanup. Storage limit is 50MB.

**Q: Does dark mode save battery?**  
A: Yes, especially on AMOLED screens. Dark mode uses true black backgrounds.

**Q: Can I automate log export?**  
A: Not currently through UI, but developers can use the API programmatically.

**Q: What happens if I clear logs?**  
A: All logs are permanently deleted from both memory and storage. Cannot be undone.

**Q: Does system theme mode work offline?**  
A: Yes, it uses device OS settings, no internet required.

---

## Useful Commands

### Development

```bash
# Start development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Clear cache
npm run start:clear

# Clean build
npm run clean
```

### Debugging

```bash
# View Android logs
adb logcat | grep -i "vpn"

# View iOS logs
tail -f ~/Library/Logs/CoreSimulator/*/system.log

# React Native debug menu
# Android: Cmd + M
# iOS: Cmd + D
```

### Building

```bash
# Android release build
cd android && ./gradlew assembleRelease

# Android bundle
cd android && ./gradlew bundleRelease
```

---

## Additional Resources

- **React Native Docs**: https://reactnative.dev
- **Expo Docs**: https://docs.expo.dev
- **Zustand Docs**: https://docs.pmnd.rs/zustand
- **AsyncStorage Docs**: https://react-native-async-storage.github.io

---

**Welcome to CB-Pro-Proxy!** 🎉

Enjoy the enhanced logging capabilities and beautiful dark mode! If you have any questions or issues, please refer to the documentation or reach out for support.
