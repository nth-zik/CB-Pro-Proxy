#!/bin/bash

# Build CB Pro Proxy for iOS Simulator
# No Apple Developer account required!

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  CB Pro Proxy - iOS Simulator Builder  ${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if in project root
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Must run from project root${NC}"
    echo "   cd to project root and run: ./scripts/build-simulator.sh"
    exit 1
fi

# Check if Xcode is installed
if ! command -v xcodebuild &> /dev/null; then
    echo -e "${RED}❌ Error: Xcode not installed${NC}"
    echo "   Install Xcode from App Store"
    exit 1
fi

echo -e "${BLUE}📋 Build Configuration${NC}"
echo "   Platform: iOS Simulator"
echo "   Configuration: Debug"
echo "   Code Signing: Disabled"
echo "   Apple Developer: Not Required"
echo ""

# Step 1: Check if ios directory exists
if [ ! -d "ios" ]; then
    echo -e "${YELLOW}⚠️  iOS project not found${NC}"
    echo -e "${BLUE}📦 Running expo prebuild...${NC}"
    npx expo prebuild --platform ios --no-install
    echo -e "${GREEN}✅ Prebuild completed${NC}"
    echo ""
fi

# Step 2: Install CocoaPods
echo -e "${BLUE}📦 Installing CocoaPods dependencies...${NC}"
cd ios
pod install --repo-update
cd ..
echo -e "${GREEN}✅ CocoaPods installed${NC}"
echo ""

# Step 3: Build for simulator
echo -e "${BLUE}🔨 Building for iOS Simulator...${NC}"
echo ""

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
  CODE_SIGNING_ALLOWED=NO | xcpretty || xcodebuild \
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

BUILD_STATUS=$?

if [ $BUILD_STATUS -ne 0 ]; then
    echo ""
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Build successful!${NC}"
echo ""

# Step 4: Locate .app bundle
APP_PATH=$(find build/Build/Products/Debug-iphonesimulator -name "*.app" -type d | head -n 1)

if [ -z "$APP_PATH" ]; then
    echo -e "${RED}❌ Could not find .app bundle${NC}"
    exit 1
fi

echo -e "${BLUE}📍 App bundle location:${NC}"
echo "   $APP_PATH"
echo ""

# Step 5: Create distribution archive
echo -e "${BLUE}📦 Creating distribution archive...${NC}"

DIST_DIR="build/simulator-dist"
mkdir -p "$DIST_DIR"

# Copy .app
cp -R "$APP_PATH" "$DIST_DIR/"

# Create README
cat > "$DIST_DIR/README.txt" << 'EOF'
CB Pro Proxy - iOS Simulator Build
====================================

This is a simulator build for testing purposes only.

INSTALLATION
------------

Method 1: Drag & Drop
1. Open Xcode
2. Window → Devices and Simulators (⇧⌘2)
3. Select iOS Simulators tab
4. Select a simulator from the list
5. Drag CBVVPN.app onto the simulator window

Method 2: Command Line
xcrun simctl install booted CBVVPN.app

RUNNING
-------

Launch via command line:
xcrun simctl launch booted com.cbv.vpn

Or click the app icon in the simulator.

AVAILABLE SIMULATORS
--------------------

List all simulators:
xcrun simctl list devices

Boot a specific simulator:
xcrun simctl boot "iPhone 15"

Open Simulator app:
open -a Simulator

TESTING
-------

Run with logging:
xcrun simctl launch --console booted com.cbv.vpn

View logs:
xcrun simctl spawn booted log stream --predicate 'process == "CBVVPN"'

UNINSTALL
---------

xcrun simctl uninstall booted com.cbv.vpn

NOTES
-----

⚠️  This build ONLY works on iOS Simulator
⚠️  Cannot be installed on physical devices
⚠️  No code signing or provisioning profile
⚠️  Network Extension may have limited functionality in simulator

For device builds, see .github/workflows/build-ios.yml
EOF

# Create install script
cat > "$DIST_DIR/install.sh" << 'EOF'
#!/bin/bash

# Quick install script for iOS Simulator

echo "🚀 Installing CB Pro Proxy on iOS Simulator..."
echo ""

# Check if simulator is booted
BOOTED=$(xcrun simctl list devices | grep "(Booted)" | head -n 1)

if [ -z "$BOOTED" ]; then
    echo "⚠️  No simulator is currently running"
    echo ""
    echo "Starting iPhone 15..."
    xcrun simctl boot "iPhone 15" 2>/dev/null || true
    sleep 2
    open -a Simulator
    sleep 3
fi

# Install app
xcrun simctl install booted CBVVPN.app

echo ""
echo "✅ Installation complete!"
echo ""
echo "Launch the app:"
echo "  xcrun simctl launch booted com.cbv.vpn"
echo ""
EOF

chmod +x "$DIST_DIR/install.sh"

# Create zip archive
cd build
zip -r "CBVVPN-Simulator.zip" simulator-dist
cd ..

ARCHIVE_PATH="$(pwd)/build/CBVVPN-Simulator.zip"

echo -e "${GREEN}✅ Archive created${NC}"
echo ""

# Step 6: Summary
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✅ Build Successful!${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📦 Outputs:${NC}"
echo "   App Bundle:  $APP_PATH"
echo "   Archive:     $ARCHIVE_PATH"
echo ""
echo -e "${BLUE}🚀 Quick Install:${NC}"
echo -e "   ${YELLOW}cd ios/build/simulator-dist && ./install.sh${NC}"
echo ""
echo -e "${BLUE}📱 Manual Install:${NC}"
echo "   1. Boot simulator: ${YELLOW}open -a Simulator${NC}"
echo "   2. Install app:    ${YELLOW}xcrun simctl install booted CBVVPN.app${NC}"
echo "   3. Launch app:     ${YELLOW}xcrun simctl launch booted com.cbv.vpn${NC}"
echo ""
echo -e "${BLUE}📋 List Simulators:${NC}"
echo "   ${YELLOW}xcrun simctl list devices${NC}"
echo ""
echo -e "${BLUE}🔍 View Logs:${NC}"
echo "   ${YELLOW}xcrun simctl spawn booted log stream --predicate 'process == \"CBVVPN\"'${NC}"
echo ""
echo -e "${GREEN}Happy Testing! 🎉${NC}"
echo ""

cd ..
