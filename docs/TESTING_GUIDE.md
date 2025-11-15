# Testing Guide

**CB-Pro-Proxy - Logging System & Dark Mode**  
**Version:** 1.0  
**Last Updated:** 2025-01-14

This guide provides comprehensive testing procedures for the Logging System and Dark Mode features.

---

## Table of Contents

1. [Testing Overview](#testing-overview)
2. [Logging System Tests](#logging-system-tests)
3. [Dark Mode Tests](#dark-mode-tests)
4. [Integration Tests](#integration-tests)
5. [Performance Tests](#performance-tests)
6. [Known Issues](#known-issues)

---

## Testing Overview

### Prerequisites

- CB-Pro-Proxy app installed on device/emulator
- Access to app settings
- Ability to trigger VPN connections
- Console/log access for debugging

### Testing Approach

- **Manual Testing**: Interactive UI validation
- **Functional Testing**: Feature behavior verification
- **Visual Testing**: UI/UX validation across themes
- **Performance Testing**: Resource usage monitoring
- **Edge Case Testing**: Boundary conditions and error scenarios

---

## Logging System Tests

### Test 1: Basic Logging Functionality

**Objective**: Verify that logs are created and displayed correctly.

**Steps**:

1. Open the app
2. Navigate to Logs screen (via navigation menu)
3. Perform various actions (connect VPN, navigate screens, etc.)
4. Return to Logs screen

**Expected Results**:

- ✅ Logs appear in real-time
- ✅ Each log shows: timestamp, level badge, category, message
- ✅ Logs are ordered by timestamp (newest first)
- ✅ Different log levels have distinct visual indicators

**Screenshot Suggestions**:

- Logs screen showing various log levels
- Log entry detail view (if applicable)

---

### Test 2: Log Level Filtering

**Objective**: Verify log level filtering works correctly.

**Steps**:

1. Open Logs screen
2. Generate logs of different levels by:
   - Performing successful actions (INFO logs)
   - Triggering warnings (try invalid inputs)
   - Causing errors (disconnect during connection)
3. Test each filter button:
   - Click "ALL" - should show all logs
   - Click "INFO" - should show only info logs
   - Click "WARN" - should show only warnings
   - Click "ERROR" - should show only errors
   - Click "DEBUG" - should show debug logs (if enabled)
   - Click "CRITICAL" - should show critical logs

**Expected Results**:

- ✅ Filter buttons highlight when active
- ✅ Log count updates correctly
- ✅ Only matching logs are displayed
- ✅ "Showing X of Y logs" counter is accurate
- ✅ Can switch between filters smoothly

---

### Test 3: Category Filtering

**Objective**: Verify log category filtering works correctly.

**Steps**:

1. Open Logs screen
2. Observe logs from different categories
3. Test each category filter:
   - Click "ALL" - shows all categories
   - Click "VPN" - shows only VPN-related logs
   - Click "NETWORK" - shows only network logs
   - Click "STORAGE" - shows only storage logs
   - Click "UI" - shows only UI interaction logs
   - Click "APP" - shows only app lifecycle logs

**Expected Results**:

- ✅ Category filters work independently of level filters
- ✅ Can combine level and category filters
- ✅ Filter combinations are accurate
- ✅ Category badges match the filtered category

---

### Test 4: Search Functionality

**Objective**: Verify search filters logs correctly.

**Steps**:

1. Open Logs screen with various logs
2. Enter search terms in search box:
   - Search for "VPN"
   - Search for "error"
   - Search for a profile name
   - Search for partial words
   - Search with special characters
3. Clear search and verify all logs return

**Expected Results**:

- ✅ Search is case-insensitive
- ✅ Matches message content
- ✅ Matches data/metadata content
- ✅ Results update as you type
- ✅ Search works with active filters
- ✅ Clear search returns all (filtered) logs

---

### Test 5: Export Functionality

**Objective**: Verify log export works correctly.

**Steps**:

1. Open Logs screen with several logs
2. Apply some filters (optional)
3. Tap "Export" button
4. Choose share destination (email, save to files, etc.)
5. Verify exported content

**Expected Results**:

- ✅ Export button is accessible
- ✅ Share sheet appears with export options
- ✅ Exported logs are in JSON format
- ✅ Only filtered logs are exported (if filters active)
- ✅ JSON structure is valid and readable
- ✅ All log data is preserved (timestamp, level, category, message, data)

**Export Format Example**:

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": 1705190400000,
    "level": "info",
    "category": "vpn",
    "message": "VPN connected successfully",
    "data": {
      "profileId": "profile-123"
    }
  }
]
```

---

### Test 6: Clear Logs

**Objective**: Verify clearing logs works correctly and safely.

**Steps**:

1. Open Logs screen with logs present
2. Tap "Clear" button
3. Verify confirmation dialog appears
4. Test "Cancel" - logs remain
5. Tap "Clear" again
6. Confirm deletion
7. Verify logs are cleared

**Expected Results**:

- ✅ Confirmation dialog prevents accidental deletion
- ✅ "Cancel" keeps logs intact
- ✅ "Clear" removes all logs from display
- ✅ Logs are removed from storage
- ✅ Success message appears
- ✅ Empty state message displays
- ✅ New logs can be created after clearing

---

### Test 7: Log Persistence

**Objective**: Verify logs persist across app restarts.

**Steps**:

1. Open app and generate some logs
2. Note the log count
3. Force quit the app completely
4. Reopen the app
5. Navigate to Logs screen

**Expected Results**:

- ✅ Previous logs are still visible
- ✅ Log count matches (or is close, allowing for cleanup)
- ✅ No duplicate logs appear
- ✅ Logs are in correct order

---

### Test 8: Log Rotation

**Objective**: Verify old logs are cleaned up correctly.

**Steps**:

1. Generate many logs over several days (if possible)
2. Check log count periodically
3. After 30 days, verify old logs are removed

**Expected Results**:

- ✅ Logs older than 30 days are removed
- ✅ Recent logs are preserved
- ✅ Storage size stays within limits (50MB)
- ✅ No performance degradation with many logs

**Note**: This test requires extended time. For quick testing, you can manually modify the retention period in the code.

---

### Test 9: VPN Event Logging

**Objective**: Verify VPN events are logged correctly.

**Steps**:

1. Open Logs screen
2. Start a VPN connection
3. Observe logs during connection
4. Disconnect VPN
5. Observe logs during disconnection

**Expected Results**:

- ✅ "VPN connection initiated" log appears
- ✅ "VPN status changed" logs appear
- ✅ Connection success/failure is logged
- ✅ Disconnection is logged
- ✅ All VPN logs have category "vpn"
- ✅ Profile ID is included in log data

---

### Test 10: Error Logging

**Objective**: Verify errors are logged with stack traces.

**Steps**:

1. Trigger various errors:
   - Invalid profile configuration
   - Network timeout
   - Storage failure
   - Permission denial
2. Check Logs screen for error entries

**Expected Results**:

- ✅ Errors are logged with level "error" or "critical"
- ✅ Error message is descriptive
- ✅ Stack trace is captured (if available)
- ✅ Error category is appropriate
- ✅ Error context data is included

---

## Dark Mode Tests

### Test 11: Theme Switching

**Objective**: Verify theme can be switched smoothly.

**Steps**:

1. Open app (default theme)
2. Go to Settings screen
3. Locate "Appearance" or "Theme" section
4. Switch between:
   - Light mode
   - Dark mode
   - System mode
5. Observe theme change

**Expected Results**:

- ✅ Theme changes immediately
- ✅ All screens update to new theme
- ✅ No visual glitches during transition
- ✅ Theme preference is saved
- ✅ StatusBar color updates correctly

---

### Test 12: System Theme Detection

**Objective**: Verify "System" theme mode follows device settings.

**Steps**:

1. Set app theme to "System"
2. Change device theme to Dark (in device settings)
3. Return to app
4. Verify app is in dark mode
5. Change device theme to Light
6. Return to app
7. Verify app is in light mode

**Expected Results**:

- ✅ App follows system theme when set to "System"
- ✅ Theme updates automatically when system changes
- ✅ Light/Dark modes override system setting
- ✅ System detection works on app restart

**Platform Notes**:

- iOS: Settings > Display & Brightness > Appearance
- Android: Settings > Display > Dark theme

---

### Test 13: Visual Consistency - Light Mode

**Objective**: Verify all components look correct in light mode.

**Steps**:

1. Set theme to Light
2. Navigate through all screens:
   - Connection Screen
   - Profile List Screen
   - Profile Form Screen
   - Settings Screen
   - Logs Screen
3. Check each element:
   - Backgrounds
   - Text (primary, secondary, disabled)
   - Buttons (primary, secondary, disabled)
   - Input fields
   - Cards
   - Borders
   - Icons

**Expected Results**:

- ✅ All text is readable (good contrast)
- ✅ Backgrounds are light
- ✅ Primary text is dark
- ✅ Interactive elements are visible
- ✅ No white-on-white or dark-on-dark issues
- ✅ Disabled states are distinguishable
- ✅ Focus states are visible

**Contrast Requirements** (WCAG AA):

- Normal text: ≥ 4.5:1
- Large text: ≥ 3:1
- UI components: ≥ 3:1

---

### Test 14: Visual Consistency - Dark Mode

**Objective**: Verify all components look correct in dark mode.

**Steps**:

1. Set theme to Dark
2. Navigate through all screens (same as Test 13)
3. Check each element (same as Test 13)

**Expected Results**:

- ✅ All text is readable (good contrast)
- ✅ Backgrounds are dark
- ✅ Primary text is light/white
- ✅ Interactive elements are visible
- ✅ No black-on-black or light-on-light issues
- ✅ Disabled states are distinguishable
- ✅ Focus states are visible
- ✅ AMOLED-friendly (true black background)

---

### Test 15: ThemedComponents

**Objective**: Verify themed components render correctly.

**Steps**:

1. Find screens using ThemedComponents:
   - ThemedView
   - ThemedText
   - ThemedCard
   - ThemedButton
   - ThemedSwitch
   - ThemedSettingRow
2. Switch between light and dark modes
3. Verify each component type

**Expected Results**:

- ✅ All themed components update on theme change
- ✅ Colors are appropriate for current theme
- ✅ Variants work correctly (primary, secondary, etc.)
- ✅ Sizes work correctly (sm, md, lg, etc.)
- ✅ No hardcoded colors visible

---

### Test 16: VPN Status Colors

**Objective**: Verify VPN status colors are visible in both themes.

**Steps**:

1. Test in Light mode:
   - Connect VPN (observe connected color)
   - Disconnect VPN (observe disconnected color)
   - Trigger error (observe error color)
2. Switch to Dark mode
3. Repeat VPN status changes
4. Compare color visibility

**Expected Results**:

- ✅ Connected: Green (visible in both themes)
- ✅ Connecting: Magenta/Pink (visible in both themes)
- ✅ Disconnected: Blue (visible in both themes)
- ✅ Error: Red (visible in both themes)
- ✅ All status colors have good contrast
- ✅ Colors are semantically appropriate

---

### Test 17: Theme Persistence

**Objective**: Verify theme preference persists across app restarts.

**Steps**:

1. Set theme to Dark
2. Force quit app
3. Reopen app
4. Verify theme is still Dark
5. Set theme to Light
6. Restart app
7. Verify theme is Light
8. Set theme to System
9. Restart app
10. Verify theme follows system

**Expected Results**:

- ✅ Theme preference is saved to AsyncStorage
- ✅ App loads with saved theme
- ✅ No flash of wrong theme on startup
- ✅ System mode is remembered correctly

---

### Test 18: Tab Bar Theme

**Objective**: Verify navigation tab bar uses correct theme colors.

**Steps**:

1. Switch to Light mode
2. Observe tab bar colors (background, icons, labels)
3. Switch to Dark mode
4. Observe tab bar colors again

**Expected Results**:

- ✅ Tab bar background updates with theme
- ✅ Active tab is highlighted correctly
- ✅ Inactive tabs are visible but dimmed
- ✅ Tab icons match theme
- ✅ Tab border/divider is visible

---

## Integration Tests

### Test 19: Logging + Dark Mode

**Objective**: Verify logging works correctly in both themes.

**Steps**:

1. Set theme to Light
2. Open Logs screen
3. Verify logs are readable
4. Switch to Dark mode
5. Verify logs update correctly
6. Filter and search logs in dark mode

**Expected Results**:

- ✅ Logs screen updates to dark theme
- ✅ Log level badges are visible in both themes
- ✅ Filters work in both themes
- ✅ Search input is styled correctly
- ✅ Export/Clear buttons are visible

---

### Test 20: Settings Screen Integration

**Objective**: Verify Settings screen integrates both features correctly.

**Steps**:

1. Open Settings screen
2. Locate "Appearance" section (theme controls)
3. Locate "Logging" section (if present)
4. Test theme switching from settings
5. Test logging configuration (if present)

**Expected Results**:

- ✅ Both sections are present and organized
- ✅ Theme selector works (Light/Dark/System)
- ✅ Theme changes reflect immediately
- ✅ Logging toggle works (if implemented)
- ✅ Settings persist across restarts

---

### Test 21: Complete User Flow

**Objective**: Test a complete user workflow with both features.

**Steps**:

1. Open app in Light mode
2. Create a new VPN profile
3. Check logs for profile creation events
4. Connect VPN
5. Check logs for connection events
6. Switch to Dark mode
7. Verify UI updates smoothly
8. Disconnect VPN
9. Check logs for disconnection
10. Export logs
11. Clear logs

**Expected Results**:

- ✅ All actions are logged correctly
- ✅ Theme changes don't interrupt workflow
- ✅ No errors occur
- ✅ UI remains responsive
- ✅ Data persistence works correctly

---

## Performance Tests

### Test 22: Logging Performance

**Objective**: Verify logging doesn't impact app performance.

**Steps**:

1. Enable all log levels
2. Perform intensive operations:
   - Multiple VPN connects/disconnects
   - Rapid screen navigation
   - Profile creation/deletion
3. Monitor:
   - App responsiveness
   - Memory usage
   - Storage growth

**Expected Results**:

- ✅ UI remains responsive (60fps)
- ✅ No noticeable lag from logging
- ✅ Memory usage stays reasonable
- ✅ Storage growth is controlled
- ✅ Log rotation works automatically

**Performance Benchmarks**:

- Log write: < 1ms (in-memory)
- Log persist: < 5ms (async)
- UI render: < 16ms (60fps)
- Max memory: +10MB with 1000 logs

---

### Test 23: Theme Switch Performance

**Objective**: Verify theme switching is instant.

**Steps**:

1. Open complex screen (e.g., Profile List with many items)
2. Measure theme switch time
3. Switch theme multiple times rapidly
4. Observe any performance issues

**Expected Results**:

- ✅ Theme switch is near-instant (< 16ms)
- ✅ No layout shift during switch
- ✅ No component re-mount
- ✅ Smooth transition (if implemented)
- ✅ No memory leaks after multiple switches

---

### Test 24: Large Log Set Performance

**Objective**: Verify app handles large numbers of logs efficiently.

**Steps**:

1. Generate 1000+ logs (may need dev tools)
2. Open Logs screen
3. Test filtering and searching
4. Scroll through logs
5. Monitor performance

**Expected Results**:

- ✅ Logs screen loads reasonably fast
- ✅ Filtering is responsive
- ✅ Scrolling is smooth (virtualized list)
- ✅ Search doesn't freeze UI
- ✅ Memory usage is acceptable

---

## Known Issues

### Current Limitations

1. **Log Export Formats**

   - Currently only JSON export via Share API
   - CSV and TXT formats implemented but not exposed in UI
   - **Workaround**: Use JSON export for now

2. **Theme Transition**

   - No animated transition between themes
   - Instant switch may feel abrupt
   - **Workaround**: Acceptable UX, no fix needed

3. **Log Search**

   - Search doesn't highlight matches
   - Only filters, doesn't emphasize found text
   - **Workaround**: Results are filtered correctly

4. **Platform Differences**
   - System theme detection may behave differently on iOS vs Android
   - Dark mode colors optimized for AMOLED (pure black)
   - **Note**: Expected behavior, not a bug

### Resolved Issues

None currently - first release

---

## Test Summary Template

Use this template to document your test results:

```markdown
## Test Session Summary

**Date**: YYYY-MM-DD
**Tester**: [Name]
**Platform**: iOS/Android
**Device**: [Device Model]
**App Version**: [Version]

### Test Results

| Test # | Test Name          | Status  | Notes |
| ------ | ------------------ | ------- | ----- |
| 1      | Basic Logging      | ✅ PASS |       |
| 2      | Level Filtering    | ✅ PASS |       |
| 3      | Category Filtering | ✅ PASS |       |
| ...    | ...                | ...     | ...   |

### Issues Found

1. [Issue description]
   - Severity: High/Medium/Low
   - Steps to reproduce:
   - Expected vs Actual:
   - Screenshots:

### Overall Assessment

- Features Working: X/Y
- Critical Issues: N
- Minor Issues: M
- Recommendations:
```

---

## Additional Testing Tools

### Console Logging

Monitor development console for:

- Error messages
- Warning messages
- Performance warnings

### React Native Debugger

Use for:

- Redux/Zustand store inspection
- Network request monitoring
- Performance profiling

### Platform-Specific Tools

**iOS**:

- Xcode Instruments (memory, CPU)
- Console.app (system logs)

**Android**:

- Android Studio Profiler
- Logcat filtering
- Layout Inspector

---

## Regression Testing Checklist

Before each release, verify:

- [ ] All log levels work correctly
- [ ] All log categories work correctly
- [ ] Log filtering and search work
- [ ] Log export works
- [ ] Log persistence works
- [ ] Log rotation works
- [ ] Theme switching works in all screens
- [ ] System theme detection works
- [ ] Theme persistence works
- [ ] All ThemedComponents render correctly
- [ ] VPN status colors are correct
- [ ] No performance degradation
- [ ] No memory leaks
- [ ] All platforms tested (iOS + Android)

---

## Feedback and Bug Reports

When reporting issues, include:

1. **Device Information**

   - Platform (iOS/Android)
   - OS Version
   - Device Model

2. **App Information**

   - App Version
   - Build Number

3. **Issue Details**

   - Expected behavior
   - Actual behavior
   - Steps to reproduce
   - Screenshots/Videos

4. **Logs**
   - Export logs if relevant
   - Include error messages
   - Note timestamp of issue

---

## Resources

- **Implementation Guide**: [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)
- **Quick Start**: [QUICK_START.md](./QUICK_START.md)
- **Feature Design**: [FEATURE_DESIGN.md](./FEATURE_DESIGN.md)
