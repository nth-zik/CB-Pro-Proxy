# iOS Proxy Implementation Guide

## Overview

This document describes the iOS proxy implementation for the CB Pro Proxy VPN application. The implementation uses Apple's NetworkExtension framework to create a packet tunnel that routes traffic through SOCKS5 or HTTP proxies.

## Architecture

### Components

1. **VPNModule** (`VPNModule.swift`, `VPNModule.m`)
   - React Native bridge module
   - Provides JavaScript interface for VPN control
   - Manages communication between React Native and native iOS code
   - Events: statusChanged, error, profilesUpdated, vpnPermissionRequired, activeProfileChanged

2. **VPNManager** (`VPNManager.swift`)
   - Manages VPN connections using NETunnelProviderManager
   - Handles VPN lifecycle (start, stop, status monitoring)
   - Monitors VPN status changes and emits events
   - Tracks connection duration and statistics

3. **ProfileStorage** (`ProfileStorage.swift`)
   - Persistent storage for VPN profiles
   - Uses UserDefaults with App Group for sharing between main app and extension
   - CRUD operations for profiles

4. **VPNProfile** (`VPNProfile.swift`)
   - Data model for VPN/proxy profiles
   - Supports both SOCKS5 and HTTP proxy types
   - Includes authentication credentials

5. **SOCKS5ProxyHandler** (`SOCKS5ProxyHandler.swift`)
   - Implements SOCKS5 proxy protocol (RFC 1928)
   - Supports username/password authentication (RFC 1929)
   - Handles connection negotiation and tunneling

6. **HTTPProxyHandler** (`HTTPProxyHandler.swift`)
   - Implements HTTP CONNECT proxy protocol
   - Supports Basic authentication (Proxy-Authorization header)
   - HTTP/1.1 tunneling

7. **PacketTunnelProvider** (`PacketTunnelProvider.swift`)
   - Network Extension packet tunnel provider
   - Intercepts all network traffic at IP packet level
   - Routes traffic through configured proxy
   - Handles IPv4 (and basic IPv6) packets

## Setup Instructions

### 1. Xcode Project Configuration

#### Add Network Extension Target

1. Open `CBVVPN.xcodeproj` in Xcode
2. Add a new target:
   - File → New → Target
   - Select "Network Extension"
   - Product Name: "PacketTunnel"
   - Bundle Identifier: "com.cbv.vpn.PacketTunnel"
   - Language: Swift

3. Add all PacketTunnel files to the PacketTunnel target:
   - `PacketTunnelProvider.swift`
   - `SOCKS5ProxyHandler.swift`
   - `HTTPProxyHandler.swift`
   - `VPNProfile.swift` (shared with main app)
   - `Info.plist`
   - `PacketTunnel.entitlements`

#### Configure Main App Target

1. Add VPNModule files to CBVVPN target:
   - `VPNModule.swift`
   - `VPNModule.m`
   - `VPNManager.swift`
   - `VPNProfile.swift`
   - `ProfileStorage.swift`
   - `CBVVPN-Bridging-Header.h`

2. Update `CBVVPN-Bridging-Header.h`:
```objc
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
```

3. Set Bridging Header path in Build Settings:
   - Swift Compiler - General
   - Objective-C Bridging Header: `CBVVPN/CBVVPN-Bridging-Header.h`

### 2. Entitlements Configuration

#### Main App Entitlements (`CBVVPN.entitlements`)

Already configured with:
- `com.apple.developer.networking.networkextension` - packet-tunnel-provider
- `com.apple.security.application-groups` - group.com.cbv.vpn

#### Network Extension Entitlements (`PacketTunnel.entitlements`)

Already configured with same capabilities.

### 3. App Groups

Configure App Groups for data sharing:
1. Select CBVVPN target → Signing & Capabilities
2. Add App Groups capability
3. Add group: `group.com.cbv.vpn`
4. Repeat for PacketTunnel target

### 4. Bundle Identifiers

Ensure bundle identifiers are correctly set:
- Main App: `com.cbv.vpn`
- Network Extension: `com.cbv.vpn.PacketTunnel`

### 5. Update VPNManager Bundle Identifier

In `VPNManager.swift:72`, update the bundle identifier if needed:
```swift
protocolConfiguration.providerBundleIdentifier = "com.cbv.vpn.PacketTunnel"
```

## Capabilities Required

### Apple Developer Account

⚠️ **IMPORTANT**: Network Extension requires specific entitlements that must be enabled in your Apple Developer account:

1. Log in to [Apple Developer Portal](https://developer.apple.com)
2. Navigate to Certificates, Identifiers & Profiles
3. Select your App ID (com.cbv.vpn)
4. Enable "Network Extensions" capability
5. Create/update provisioning profiles with Network Extensions enabled

### Development vs Distribution

- **Development**: Can test on physical devices with Development provisioning profile
- **TestFlight/App Store**: Requires Distribution provisioning profile with Network Extensions
- **Simulator**: Limited support - some NetworkExtension features may not work

## API Interface

The iOS implementation matches the Android VPNModule interface:

### Methods

```typescript
// Profile Management
getProfiles(): Promise<Profile[]>
saveProfile(name, host, port, type, username, password): Promise<string>
deleteProfile(profileId): Promise<void>

// VPN Control
startVPN(profileId): Promise<void>
startVPNWithProfile(name, host, port, type, username, password, dns1?, dns2?): Promise<void>
stopVPN(): Promise<void>
getStatus(): Promise<VPNStatusInfo>
refreshStatus(): void
```

### Events

```typescript
// Status changes
statusChanged: { state, isConnected, durationMillis, bytesUp, bytesDown, publicIp? }
// States: "disconnected" | "connecting" | "connected" | "handshaking" | "error"

// Errors
error: string

// Profile updates
profilesUpdated: { id, name, host, port, type, hasAuth, isUpdate }

// VPN permission (iOS doesn't require this, but kept for API compatibility)
vpnPermissionRequired: { profileId, profileName }

// Active profile changes
activeProfileChanged: { profileId, profileName }
```

## Proxy Support

### SOCKS5 Proxy

- Full SOCKS5 protocol implementation (RFC 1928)
- Authentication methods:
  - No authentication (0x00)
  - Username/Password (0x02, RFC 1929)
- Connection methods:
  - CONNECT command (TCP tunneling)
  - IPv4, IPv6, and domain name addressing

### HTTP Proxy

- HTTP CONNECT tunneling
- Basic authentication (Base64 encoded credentials)
- Proxy-Authorization header support

## Known Limitations

### Current Implementation

1. **Packet Routing**: The PacketTunnelProvider currently logs packets but doesn't fully implement TCP/UDP state machines for proxying all traffic. For production use, consider:
   - Integrating [go-tun2socks](https://github.com/shadowsocks/go-tun2socks)
   - Implementing full TCP state machine similar to Android
   - Using swift-nio for async networking

2. **IPv6**: Basic IPv6 packet parsing is implemented but full support needs additional work

3. **UDP**: UDP association is logged but not fully implemented. SOCKS5 supports UDP ASSOCIATE, but requires additional implementation.

4. **Statistics**: Bytes up/down are currently 0 - need to track actual traffic volume

5. **Public IP Detection**: Not yet implemented (would require HTTP request to IP detection service)

### Recommended Enhancements

For a production-ready implementation:

1. **Integrate tun2socks library** for full packet routing:
```swift
// Example using go-tun2socks via Gomobile
import Tun2socks

let tun2socks = Tun2socksNewTun2Socks(
    tunFd: Int(packetFlow.fileDescriptor),
    mtu: 1500,
    socksServer: "\(host):\(port)",
    username: username,
    password: password
)
```

2. **Implement connection tracking**:
   - TCP connection table (SYN, ACK, FIN handling)
   - UDP session tracking
   - Connection multiplexing

3. **Add statistics tracking**:
   - Bytes sent/received per connection
   - Aggregate traffic statistics
   - Public IP detection via API call

4. **Error handling improvements**:
   - Retry logic for proxy connection failures
   - Fallback DNS handling
   - Network transition handling (WiFi ↔ Cellular)

## Testing

### Manual Testing

1. Build and run on physical iOS device (Network Extension doesn't work reliably in Simulator)
2. Create a proxy profile in the app
3. Start VPN connection
4. Check VPN status in Settings → VPN
5. Test network connectivity (Safari, apps, etc.)

### Debugging

Enable detailed logging in PacketTunnelProvider:
```swift
// View logs in Console.app
// Filter by process: PacketTunnel
NSLog("🚀 Message here")
```

View logs:
1. Open Console.app on Mac
2. Select connected iOS device
3. Filter by process name: "PacketTunnel" or "CBVVPN"
4. Watch logs in real-time

### Common Issues

1. **"VPN connection failed"**
   - Check bundle identifiers match
   - Verify entitlements are correctly configured
   - Ensure App Group is configured on both targets

2. **"No network connectivity"**
   - Verify proxy server is accessible
   - Check proxy credentials are correct
   - Ensure DNS settings are configured

3. **"Cannot install app"**
   - Network Extensions capability not enabled in Developer Portal
   - Provisioning profile doesn't include Network Extensions

## File Structure

```
ios/
├── CBVVPN/                          # Main app target
│   ├── AppDelegate.swift
│   ├── VPNModule.swift              # React Native bridge
│   ├── VPNModule.m                  # Bridge definition
│   ├── VPNManager.swift             # VPN connection manager
│   ├── VPNProfile.swift             # Profile model (shared)
│   ├── ProfileStorage.swift         # Profile persistence
│   ├── SOCKS5ProxyHandler.swift    # SOCKS5 implementation
│   ├── HTTPProxyHandler.swift      # HTTP proxy implementation
│   ├── CBVVPN-Bridging-Header.h
│   └── CBVVPN.entitlements
│
└── PacketTunnel/                    # Network Extension target
    ├── PacketTunnelProvider.swift   # Main extension class
    ├── SOCKS5ProxyHandler.swift    # SOCKS5 (copy/link)
    ├── HTTPProxyHandler.swift      # HTTP proxy (copy/link)
    ├── VPNProfile.swift             # Profile model (shared)
    ├── Info.plist
    └── PacketTunnel.entitlements
```

## Migration from Android

The iOS implementation closely mirrors the Android implementation:

| Android | iOS |
|---------|-----|
| VPNModule.kt | VPNModule.swift |
| VPNConnectionService.kt | PacketTunnelProvider.swift |
| SOCKS5ProxyHandler.kt | SOCKS5ProxyHandler.swift |
| HTTPProxyHandler.kt | HTTPProxyHandler.swift |
| ProfileStorage (SharedPreferences) | ProfileStorage (UserDefaults + App Group) |

Key differences:
- iOS uses NetworkExtension framework vs Android's VpnService
- iOS uses separate Network Extension target vs Android's Service
- iOS uses App Groups for data sharing vs Android's SharedPreferences
- iOS requires specific entitlements from Apple Developer Portal

## Next Steps

1. ✅ Basic VPN module and proxy handlers implemented
2. ✅ Network Extension structure created
3. ⏳ Add PacketTunnel target to Xcode project
4. ⏳ Configure entitlements in Apple Developer Portal
5. ⏳ Implement full packet routing (consider tun2socks integration)
6. ⏳ Add traffic statistics tracking
7. ⏳ Add public IP detection
8. ⏳ Test on physical device
9. ⏳ Production testing and optimization

## Resources

- [Apple NetworkExtension Documentation](https://developer.apple.com/documentation/networkextension)
- [NEPacketTunnelProvider Guide](https://developer.apple.com/documentation/networkextension/nepackettunnelprovider)
- [SOCKS5 RFC 1928](https://www.rfc-editor.org/rfc/rfc1928)
- [SOCKS5 Auth RFC 1929](https://www.rfc-editor.org/rfc/rfc1929)
- [go-tun2socks](https://github.com/shadowsocks/go-tun2socks)

## Support

For issues or questions:
1. Check Console.app logs for detailed error messages
2. Verify all configuration steps are completed
3. Ensure device has iOS 15.1+ (deployment target)
4. Test proxy server independently (curl/netcat)
