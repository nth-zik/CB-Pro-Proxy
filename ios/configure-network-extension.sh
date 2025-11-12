#!/bin/bash

# iOS Network Extension Configuration Helper Script
# This script helps automate some of the Network Extension setup steps

set -e

echo "🔧 CB Pro Proxy - iOS Network Extension Configuration Helper"
echo "============================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running in iOS directory
if [ ! -f "CBVVPN.xcodeproj/project.pbxproj" ]; then
    echo -e "${RED}❌ Error: Please run this script from the ios/ directory${NC}"
    echo "   cd ios && ./configure-network-extension.sh"
    exit 1
fi

echo -e "${BLUE}📋 Checking iOS project structure...${NC}"
echo ""

# Check for required Swift files
REQUIRED_FILES=(
    "CBVVPN/VPNModule.swift"
    "CBVVPN/VPNModule.m"
    "CBVVPN/VPNManager.swift"
    "CBVVPN/VPNProfile.swift"
    "CBVVPN/ProfileStorage.swift"
    "CBVVPN/SOCKS5ProxyHandler.swift"
    "CBVVPN/HTTPProxyHandler.swift"
    "PacketTunnel/PacketTunnelProvider.swift"
)

MISSING_FILES=()
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅${NC} $file"
    else
        echo -e "${RED}❌${NC} $file ${RED}(MISSING)${NC}"
        MISSING_FILES+=("$file")
    fi
done

echo ""

if [ ${#MISSING_FILES[@]} -ne 0 ]; then
    echo -e "${RED}❌ Missing required files. Please ensure all VPN module files are in place.${NC}"
    echo ""
    echo "Missing files:"
    for file in "${MISSING_FILES[@]}"; do
        echo "  - $file"
    done
    echo ""
    echo "Run 'npx expo prebuild --platform ios' to generate iOS project with all files."
    exit 1
fi

echo -e "${GREEN}✅ All required files present${NC}"
echo ""

# Check entitlements
echo -e "${BLUE}📋 Checking entitlements...${NC}"
echo ""

if [ -f "CBVVPN/CBVVPN.entitlements" ]; then
    if grep -q "com.apple.developer.networking.networkextension" "CBVVPN/CBVVPN.entitlements"; then
        echo -e "${GREEN}✅${NC} Main app entitlements configured"
    else
        echo -e "${YELLOW}⚠️${NC}  Main app entitlements missing Network Extension capability"
    fi
else
    echo -e "${RED}❌${NC} CBVVPN.entitlements not found"
fi

if [ -f "PacketTunnel/PacketTunnel.entitlements" ]; then
    echo -e "${GREEN}✅${NC} Network Extension entitlements present"
else
    echo -e "${YELLOW}⚠️${NC}  PacketTunnel.entitlements not found"
fi

echo ""

# Check Info.plist
echo -e "${BLUE}📋 Checking Info.plist configuration...${NC}"
echo ""

if [ -f "PacketTunnel/Info.plist" ]; then
    if grep -q "com.apple.networkextension.packet-tunnel" "PacketTunnel/Info.plist"; then
        echo -e "${GREEN}✅${NC} Network Extension Info.plist configured correctly"
    else
        echo -e "${YELLOW}⚠️${NC}  Network Extension Info.plist needs configuration"
    fi
else
    echo -e "${RED}❌${NC} PacketTunnel/Info.plist not found"
fi

echo ""

# Summary
echo -e "${BLUE}================================================${NC}"
echo -e "${YELLOW}📝 MANUAL CONFIGURATION REQUIRED${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo "The following steps MUST be completed manually in Xcode:"
echo ""
echo -e "${YELLOW}1. Open Xcode:${NC}"
echo "   open CBVVPN.xcworkspace"
echo ""
echo -e "${YELLOW}2. Add Network Extension Target:${NC}"
echo "   • File → New → Target"
echo "   • Select 'Network Extension'"
echo "   • Product Name: 'PacketTunnel'"
echo "   • Bundle ID: 'com.cbv.vpn.PacketTunnel'"
echo "   • Language: Swift"
echo ""
echo -e "${YELLOW}3. Add Files to Targets:${NC}"
echo "   Main app (CBVVPN) target:"
echo "   ✓ VPNModule.swift"
echo "   ✓ VPNModule.m"
echo "   ✓ VPNManager.swift"
echo "   ✓ ProfileStorage.swift"
echo ""
echo "   PacketTunnel target:"
echo "   ✓ PacketTunnelProvider.swift"
echo "   ✓ Info.plist"
echo "   ✓ PacketTunnel.entitlements"
echo ""
echo "   Both targets (shared):"
echo "   ✓ VPNProfile.swift"
echo "   ✓ SOCKS5ProxyHandler.swift"
echo "   ✓ HTTPProxyHandler.swift"
echo ""
echo -e "${YELLOW}4. Configure Signing & Capabilities:${NC}"
echo "   For CBVVPN target:"
echo "   ✓ Enable 'Automatically manage signing'"
echo "   ✓ Add 'App Groups' capability → group.com.cbv.vpn"
echo "   ✓ Add 'Network Extensions' capability"
echo ""
echo "   For PacketTunnel target:"
echo "   ✓ Enable 'Automatically manage signing'"
echo "   ✓ Add 'App Groups' capability → group.com.cbv.vpn (MUST match)"
echo "   ✓ Add 'Network Extensions' capability"
echo ""
echo -e "${YELLOW}5. Build Settings:${NC}"
echo "   CBVVPN target:"
echo "   ✓ Swift Compiler - General → Bridging Header:"
echo "     CBVVPN/CBVVPN-Bridging-Header.h"
echo ""
echo -e "${YELLOW}6. Apple Developer Portal:${NC}"
echo "   ✓ Enable 'Network Extensions' for App ID (com.cbv.vpn)"
echo "   ✓ Create/update provisioning profiles with Network Extensions"
echo "   ✓ Download and install profiles"
echo ""
echo -e "${GREEN}7. Build and Test:${NC}"
echo "   • Connect physical iOS device (required for Network Extension)"
echo "   • Product → Build (⌘B)"
echo "   • Product → Run (⌘R)"
echo ""
echo -e "${BLUE}================================================${NC}"
echo ""
echo "For detailed instructions, see:"
echo "  📖 ios/XCODE_SETUP_REQUIRED.md"
echo "  📖 ios/iOS_PROXY_IMPLEMENTATION.md"
echo ""
echo -e "${GREEN}✨ Good luck!${NC}"
