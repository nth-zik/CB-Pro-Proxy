# TrollStore Installation Guide for CB Pro Proxy

## Why TrollStore?

CB Pro Proxy requires **Network Extension entitlements** to create VPN connections. These entitlements cannot be added with:

- ❌ Free Apple ID (AltStore/Sideloadly)
- ❌ Standard jailbreak with ideviceinstaller
- ❌ Unsigned IPA installation methods

**✅ TrollStore** is the ONLY method that works without a paid Apple Developer account!

## Requirements

- **iOS 14.0 - 16.6.1** (TrollStore supported versions)
- iPhone/iPad on supported iOS version
- Computer with USB cable (for initial TrollStore setup)

## Step 1: Install TrollStore

### Method 1: TrollStore Installer (Recommended)

1. Check compatibility: https://ios.cfw.guide/installing-trollstore/
2. Visit: https://github.com/opa334/TrollStore
3. Follow installation guide for your iOS version:
   - **iOS 14.0-14.8.1**: Use TrollHelperOTA
   - **iOS 15.0-16.6.1**: Use TrollInstallerX or persistence helper

### Method 2: Using Sideloadly (iOS 14-15.5)

1. Download TrollStore IPA: https://github.com/opa334/TrollStore/releases
2. Install with Sideloadly
3. Open TrollStore and install persistence helper

## Step 2: Install CB Pro Proxy

### Build IPA

```bash
cd CB-Pro-Proxy
./build-ios-local.sh
```

Choose option 1 to build IPA. The IPA will be saved in `build-output/` folder.

### Install via TrollStore

1. **Transfer IPA to iPhone**:
   - AirDrop the IPA file to your iPhone
   - Or upload to iCloud Drive and download on iPhone
   - Or use any file transfer method

2. **Open in TrollStore**:
   - Tap the IPA file
   - Choose "Share" → "TrollStore"
   - Or open TrollStore and tap "Install" → select IPA

3. **Grant Permissions** (IMPORTANT):
   - After installation, open Settings → General → VPN & Device Management
   - You'll see "CB Pro Proxy" profile
   - Tap it and **TRUST** the profile

## Step 3: First VPN Connection

1. **Open CB Pro Proxy app**
2. **Add a proxy profile**:
   - Name, Host, Port, Type (HTTP/SOCKS5)
   - Username/Password (if required)

3. **Connect VPN**:
   - iOS will show VPN permission dialog
   - Tap **"Allow"** to add VPN configuration
   - Connection will start automatically

## Troubleshooting

### Issue: "VPN permission denied"

**Solution**: Go to Settings → General → VPN & Device Management → Trust the CB Pro Proxy profile

### Issue: "VPN did not start"

**Possible causes**:

1. **Profile not trusted**: Go to Settings and trust the app
2. **App not installed via TrollStore**: Reinstall using TrollStore
3. **iOS version incompatible**: Check TrollStore compatibility

**Check logs**:

```bash
# On Mac, view iOS logs:
idevicesyslog | grep CBVVPN
```

### Issue: "Connection failed" or "Proxy error"

**Not a TrollStore issue!** This means VPN is working but:

- Proxy server is down
- Wrong proxy credentials
- Firewall blocking connection
- Internet connection issues

**Test proxy first**:

- Use "Test Connection" button in app
- Verify proxy works with other tools

### Issue: App crashes on launch

**Solution**:

1. Uninstall app
2. Rebuild with latest code:
   ```bash
   ./build-ios-local.sh
   ```
3. Reinstall via TrollStore
4. Trust profile in Settings

## VPN Entitlements Explanation

CB Pro Proxy uses these entitlements:

```xml
<key>com.apple.developer.networking.networkextension</key>
<array>
  <string>packet-tunnel-provider</string>
</array>
<key>com.apple.security.application-groups</key>
<array>
  <string>group.com.cbv.vpn</string>
</array>
<key>keychain-access-groups</key>
<array>
  <string>$(AppIdentifierPrefix)com.cbv.vpn</string>
</array>
```

**What they do**:

- `networking.networkextension`: Create VPN tunnel and intercept traffic
- `application-groups`: Share data between main app and VPN extension
- `keychain-access-groups`: Share credentials securely

**Why TrollStore works**:

- TrollStore **fakes** these entitlements during installation
- iOS accepts them as valid
- App gets full VPN permissions without Apple signing

## Alternative: Paid Apple Developer Account

If you have a **$99/year Apple Developer account**:

1. Open project in Xcode
2. Sign with your Developer certificate
3. Enable Network Extension capability
4. Build and install via Xcode
5. VPN will work normally

## Comparison

| Method             | Cost     | VPN Works  | Setup Difficulty  |
| ------------------ | -------- | ---------- | ----------------- |
| **TrollStore**     | Free     | ✅ Yes     | Medium (one-time) |
| **Paid Developer** | $99/year | ✅ Yes     | Easy              |
| **AltStore**       | Free     | ❌ No      | Easy              |
| **Sideloadly**     | Free     | ❌ No      | Easy              |
| **Jailbreak**      | Free     | ⚠️ Maybe\* | Hard              |

\*With AppSync Unified, installation works but VPN may fail without additional tweaks

## Need Help?

- TrollStore Guide: https://ios.cfw.guide/installing-trollstore/
- TrollStore Issues: https://github.com/opa334/TrollStore/issues
- CB Pro Proxy Issues: [Your GitHub issues link]

## Summary

1. ✅ Install TrollStore (iOS 14.0-16.6.1)
2. ✅ Build IPA with `./build-ios-local.sh`
3. ✅ Install IPA through TrollStore app
4. ✅ Trust profile in Settings → VPN & Device Management
5. ✅ Open app and connect VPN (allow permission)
6. ✅ VPN fully functional!

**No paid developer account needed! 🎉**
