# Xcode Project Setup Required

## ⚠️ Important: Manual Configuration Needed

The iOS proxy implementation code has been created, but **you must complete the Xcode project configuration manually**. This cannot be automated because it requires:

1. Adding a new Network Extension target in Xcode
2. Configuring code signing and provisioning profiles
3. Setting up target dependencies and build phases

## Quick Start Checklist

Follow these steps **in order**:

### Step 1: Open Project in Xcode

```bash
cd ios
open CBVVPN.xcodeproj
```

### Step 2: Add Network Extension Target

1. In Xcode, click **File → New → Target**
2. Select **Network Extension** template
3. Configure:
   - **Product Name**: `PacketTunnel`
   - **Team**: Select your development team
   - **Language**: Swift
   - **Bundle Identifier**: `com.cbv.vpn.PacketTunnel`
4. Click **Finish**
5. When prompted about scheme, click **Activate** or **Cancel** (doesn't matter)

### Step 3: Add Files to PacketTunnel Target

Select these files in Project Navigator and check the **PacketTunnel** target in File Inspector:

**PacketTunnel Target Files:**
- ✅ `ios/PacketTunnel/PacketTunnelProvider.swift`
- ✅ `ios/PacketTunnel/Info.plist`
- ✅ `ios/PacketTunnel/PacketTunnel.entitlements`

**Shared Files** (check BOTH CBVVPN and PacketTunnel targets):
- ✅ `ios/CBVVPN/VPNProfile.swift`
- ✅ `ios/CBVVPN/SOCKS5ProxyHandler.swift`
- ✅ `ios/CBVVPN/HTTPProxyHandler.swift`

**CBVVPN Target Only:**
- ✅ `ios/CBVVPN/VPNModule.swift`
- ✅ `ios/CBVVPN/VPNModule.m`
- ✅ `ios/CBVVPN/VPNManager.swift`
- ✅ `ios/CBVVPN/ProfileStorage.swift`

### Step 4: Configure PacketTunnel Target

Select **PacketTunnel** target → **Build Settings**:

1. **Deployment Info:**
   - iOS Deployment Target: `15.1` (match main app)

2. **Packaging:**
   - Product Bundle Identifier: `com.cbv.vpn.PacketTunnel`
   - Product Name: `PacketTunnel`

3. **Swift Compiler:**
   - Install Objective-C Compatibility Header: `Yes`

4. **Code Signing:**
   - Code Signing Entitlements: `PacketTunnel/PacketTunnel.entitlements`

### Step 5: Configure CBVVPN Target

Select **CBVVPN** target → **Build Settings**:

1. **Swift Compiler - General:**
   - Objective-C Bridging Header: `CBVVPN/CBVVPN-Bridging-Header.h`

2. **Code Signing:**
   - Code Signing Entitlements: `CBVVPN/CBVVPN.entitlements`

3. Update `CBVVPN-Bridging-Header.h` if it's empty:
```objc
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
```

### Step 6: Configure Signing & Capabilities

#### For CBVVPN Target:

1. Select **CBVVPN** target → **Signing & Capabilities** tab
2. **Signing:**
   - Check "Automatically manage signing" (or configure manual signing)
   - Select your Team
3. **Add Capabilities:**
   - Click **+ Capability**
   - Add **App Groups**
     - Check/Add: `group.com.cbv.vpn`
   - Add **Network Extensions** (if not already present)

#### For PacketTunnel Target:

1. Select **PacketTunnel** target → **Signing & Capabilities** tab
2. **Signing:**
   - Check "Automatically manage signing" (or configure manual signing)
   - Select your Team (same as main app)
3. **Add Capabilities:**
   - Click **+ Capability**
   - Add **App Groups**
     - Check/Add: `group.com.cbv.vpn` (MUST match main app)
   - Add **Network Extensions** (if not already present)

### Step 7: Configure Schemes

1. Click on scheme selector (next to Run/Stop buttons)
2. Select **Edit Scheme → Run**
3. Ensure **CBVVPN** target is selected for Run

### Step 8: Build and Test

1. Select a **physical iOS device** (Network Extension doesn't work well in Simulator)
2. Click **Run** or press **Cmd+R**
3. Watch for build errors and fix them
4. Test VPN connection in the app

## Common Build Issues

### Issue: "No such module 'React'"

**Solution:** Run pod install:
```bash
cd ios
pod install
open CBVVPN.xcworkspace  # Use .xcworkspace, not .xcodeproj
```

### Issue: "Cannot find 'VPNProfile' in scope"

**Solution:** Ensure VPNProfile.swift is added to PacketTunnel target (Step 3)

### Issue: "Signing for PacketTunnel requires a development team"

**Solution:** Select your Team in Signing & Capabilities for PacketTunnel target (Step 6)

### Issue: "App Groups capability not found"

**Solution:**
1. Log in to [Apple Developer Portal](https://developer.apple.com)
2. Go to Certificates, Identifiers & Profiles
3. Select your App ID
4. Enable **App Groups** capability
5. Create App Group: `group.com.cbv.vpn`
6. Update provisioning profiles
7. Download and install new profiles in Xcode

### Issue: "Network Extensions not entitled"

**Solution:**
1. Go to [Apple Developer Portal](https://developer.apple.com)
2. Select your App ID
3. Enable **Network Extensions** capability
4. Update/download provisioning profiles
5. In Xcode: Preferences → Accounts → Download Manual Profiles

## File Organization

After completing setup, your project structure should look like:

```
CBVVPN.xcodeproj
├── CBVVPN/                     # Main app target
│   ├── VPNModule.swift         ✓ CBVVPN target
│   ├── VPNModule.m             ✓ CBVVPN target
│   ├── VPNManager.swift        ✓ CBVVPN target
│   ├── ProfileStorage.swift    ✓ CBVVPN target
│   ├── VPNProfile.swift        ✓ CBVVPN + PacketTunnel targets
│   ├── SOCKS5ProxyHandler.swift ✓ CBVVPN + PacketTunnel targets
│   ├── HTTPProxyHandler.swift  ✓ CBVVPN + PacketTunnel targets
│   └── ...
│
└── PacketTunnel/               # Network Extension target
    ├── PacketTunnelProvider.swift  ✓ PacketTunnel target
    ├── Info.plist                  ✓ PacketTunnel target
    └── PacketTunnel.entitlements   ✓ PacketTunnel target
```

## Verification Steps

After setup, verify:

1. ✅ Both targets build successfully
2. ✅ App runs on physical device
3. ✅ Can create proxy profiles in app
4. ✅ VPN toggle appears in app
5. ✅ Tapping "Connect" shows VPN prompt
6. ✅ VPN icon appears in status bar after connecting
7. ✅ Check Settings → VPN shows "CBVVPN" configuration

## Testing Checklist

- [ ] Build succeeds for both CBVVPN and PacketTunnel targets
- [ ] App installs on physical iOS device
- [ ] Create SOCKS5 proxy profile
- [ ] Create HTTP proxy profile
- [ ] Start VPN connection
- [ ] Check VPN status in Settings app
- [ ] Test network connectivity (Safari, apps)
- [ ] View logs in Console.app (filter: "PacketTunnel" or "CBVVPN")
- [ ] Stop VPN connection
- [ ] Verify VPN disconnects cleanly

## Need Help?

Refer to detailed documentation:
- 📖 [iOS_PROXY_IMPLEMENTATION.md](./iOS_PROXY_IMPLEMENTATION.md) - Complete implementation guide
- 📖 [Apple NetworkExtension Docs](https://developer.apple.com/documentation/networkextension)
- 📖 [App Groups Guide](https://developer.apple.com/documentation/xcode/configuring-app-groups)

## Next Steps After Setup

Once Xcode configuration is complete:

1. **Test on Device**: Run app on physical iOS device (required for Network Extension)
2. **Configure Proxy**: Add your proxy server details
3. **Connect**: Test VPN connection
4. **Monitor**: Use Console.app to view detailed logs
5. **Debug**: Fix any connection issues
6. **Optimize**: See iOS_PROXY_IMPLEMENTATION.md for production enhancements

## Production Considerations

For a production-ready implementation, consider:

1. **Integrate tun2socks** library for full packet routing
2. **Implement traffic statistics** tracking (bytes up/down)
3. **Add public IP detection** feature
4. **Implement retry logic** for connection failures
5. **Add network transition handling** (WiFi ↔ Cellular)
6. **Performance testing** and optimization
7. **Battery usage** optimization

See [iOS_PROXY_IMPLEMENTATION.md](./iOS_PROXY_IMPLEMENTATION.md) for details.
