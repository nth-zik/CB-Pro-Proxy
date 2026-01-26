#!/bin/bash

# Build iOS IPA Unsigned (Local Script)
# Interactive menu for building and installing iOS IPA
# Requires: ideviceinstaller for device installation (brew install ideviceinstaller)

set -e  # Exit on error

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Show interactive menu
function show_menu() {
  clear
  echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║     CB Pro Proxy - iOS Build Menu         ║${NC}"
  echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${YELLOW}Choose an option:${NC}"
  echo ""
  echo -e "  ${GREEN}1${NC}) 🔨 Build IPA (unsigned)"
  echo -e "  ${GREEN}2${NC}) 🔨📱 Build and Install to Device"
  echo -e "  ${GREEN}3${NC}) 📱 Install Latest IPA Only (no rebuild)"
  echo -e "  ${RED}4${NC}) ❌ Exit"
  echo ""
  echo -ne "${BLUE}Enter your choice [1-4]: ${NC}"
}

# Parse arguments (for backward compatibility)
AUTO_INSTALL=false
INSTALL_ONLY=false
VERSION_ARG=""
SKIP_MENU=false

for arg in "$@"; do
  case $arg in
    --install-only)
      INSTALL_ONLY=true
      AUTO_INSTALL=true
      SKIP_MENU=true
      shift
      ;;
    --install)
      AUTO_INSTALL=true
      SKIP_MENU=true
      shift
      ;;
    *)
      VERSION_ARG="$arg"
      ;;
  esac
done

# Show menu if no arguments provided
if [ "$SKIP_MENU" = false ]; then
  show_menu
  read -r choice
  
  case $choice in
    1)
      echo -e "\n${GREEN}✓ Selected: Build IPA${NC}\n"
      AUTO_INSTALL=false
      INSTALL_ONLY=false
      ;;
    2)
      echo -e "\n${GREEN}✓ Selected: Build and Install${NC}\n"
      AUTO_INSTALL=true
      INSTALL_ONLY=false
      ;;
    3)
      echo -e "\n${GREEN}✓ Selected: Install Latest IPA${NC}\n"
      AUTO_INSTALL=true
      INSTALL_ONLY=true
      ;;
    4)
      echo -e "\n${YELLOW}Exiting...${NC}\n"
      exit 0
      ;;
    *)
      echo -e "\n${RED}Invalid choice. Exiting.${NC}\n"
      exit 1
      ;;
  esac
  
  sleep 1
fi

# If install-only mode, skip to installation
if [ "$INSTALL_ONLY" = true ]; then
  echo -e "${BLUE}==================================${NC}"
  echo -e "${BLUE}  CB Pro Proxy - Install Only${NC}"
  echo -e "${BLUE}==================================${NC}"
  echo ""
  
  # Find latest IPA in build-output
  if [ ! -d "build-output" ]; then
    echo -e "${RED}✗ No build-output directory found${NC}"
    echo -e "${YELLOW}Please build first: ./build-ios-local.sh${NC}"
    exit 1
  fi
  
  IPA_FILE=$(ls -t build-output/*.ipa 2>/dev/null | head -n 1)
  
  if [ -z "$IPA_FILE" ]; then
    echo -e "${RED}✗ No IPA file found in build-output/${NC}"
    echo -e "${YELLOW}Please build first: ./build-ios-local.sh${NC}"
    exit 1
  fi
  
  IPA_NAME=$(basename "$IPA_FILE")
  echo -e "${GREEN}Found IPA: $IPA_NAME${NC}"
  echo ""
  
  # Jump to installation section
  # (Code will continue to installation part below)
else
  # Normal build process
  echo -e "${BLUE}==================================${NC}"
  echo -e "${BLUE}  CB Pro Proxy - Build iOS IPA${NC}"
  echo -e "${BLUE}==================================${NC}"
  echo ""

  # Get version from argument or app.json
  if [ -n "$VERSION_ARG" ]; then
    VERSION="$VERSION_ARG"
    echo -e "${GREEN}Using manual version: $VERSION${NC}"
  else
    VERSION=$(node -p "require('./app.json').expo.version")
    echo -e "${GREEN}Using app.json version: $VERSION${NC}"
  fi
fi

# Skip build steps if install-only
if [ "$INSTALL_ONLY" = false ]; then
  # Generate build number from timestamp
  BUILD_NUMBER=$(date +%s)
  echo -e "${GREEN}Build number: $BUILD_NUMBER${NC}"
  echo ""

  # Check dependencies
  echo -e "${YELLOW}Checking dependencies...${NC}"

  if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js not found. Please install Node.js${NC}"
    exit 1
  fi

  if ! command -v pod &> /dev/null; then
    echo -e "${RED}Error: CocoaPods not found. Installing...${NC}"
    sudo gem install cocoapods
  fi

  if ! command -v xcodebuild &> /dev/null; then
    echo -e "${RED}Error: Xcode not found. Please install Xcode${NC}"
    exit 1
  fi

  echo -e "${GREEN}✓ All dependencies found${NC}"
  echo ""

  # Install npm dependencies
  echo -e "${YELLOW}Installing npm dependencies...${NC}"
  npm install
  echo -e "${GREEN}✓ npm dependencies installed${NC}"
  echo ""

  # Update app.json version
  echo -e "${YELLOW}Updating app.json version...${NC}"
  node -e "
const fs = require('fs');
const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'));
appJson.expo.version = '$VERSION';
appJson.expo.ios.buildNumber = '$BUILD_NUMBER';
fs.writeFileSync('app.json', JSON.stringify(appJson, null, 2));
"
  echo -e "${GREEN}✓ Version updated to $VERSION (build $BUILD_NUMBER)${NC}"
  echo ""

  # Update iOS Info.plist
  echo -e "${YELLOW}Updating iOS Info.plist...${NC}"
  /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSION" ios/CBVVPN/Info.plist
  /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $BUILD_NUMBER" ios/CBVVPN/Info.plist
  /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSION" ios/CBVVPNProxyExtension/Info.plist
  /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $BUILD_NUMBER" ios/CBVVPNProxyExtension/Info.plist
  echo -e "${GREEN}✓ Info.plist updated${NC}"
  echo ""

  # Clean previous builds
  echo -e "${YELLOW}Cleaning previous builds...${NC}"
  rm -rf ios/build
  mkdir -p ios/build
  echo -e "${GREEN}✓ Build directory cleaned${NC}"
  echo ""

  # Install iOS dependencies
  echo -e "${YELLOW}Installing iOS pods (this may take a while)...${NC}"
  cd ios
  pod install --repo-update
  cd ..
  echo -e "${GREEN}✓ Pods installed${NC}"
  echo ""

  # Generate React Native codegen files
  echo -e "${YELLOW}Generating React Native codegen files...${NC}"
  mkdir -p ios/build/generated/ios
  node_modules/.bin/react-native codegen --path . --outputPath ios/build/generated/ios 2>/dev/null || true
  echo -e "${GREEN}✓ Codegen generated${NC}"
  echo ""

  # Build iOS Archive
  echo -e "${YELLOW}Building iOS archive (this will take several minutes)...${NC}"
  cd ios

  xcodebuild \
    -workspace CBVVPN.xcworkspace \
    -scheme CBVVPN \
    -configuration Release \
    -archivePath "$PWD/build/CBProProxy.xcarchive" \
    -sdk iphoneos \
    -destination 'generic/platform=iOS' \
    CODE_SIGN_IDENTITY="" \
    CODE_SIGNING_REQUIRED=NO \
    CODE_SIGNING_ALLOWED=NO \
    DEVELOPMENT_TEAM="" \
    PROVISIONING_PROFILE_SPECIFIER="" \
    clean archive 2>&1 | tee "$PWD/build/xcodebuild.log"

  BUILD_STATUS=${PIPESTATUS[0]}

  if [ $BUILD_STATUS -ne 0 ]; then
    echo -e "${RED}✗ Build failed! Check build log:${NC}"
    echo -e "${RED}  ios/build/xcodebuild.log${NC}"
    tail -n 50 "$PWD/build/xcodebuild.log"
    exit 1
  fi

  echo -e "${GREEN}✓ Archive built successfully${NC}"
  echo ""

  # Create IPA
  echo -e "${YELLOW}Creating unsigned IPA...${NC}"
  mkdir -p "$PWD/build/output/Payload"

  # Find .app bundle
  APP_PATH=$(find "$PWD/build/CBProProxy.xcarchive/Products/Applications" -name "*.app" -type d -maxdepth 1 | head -n 1)

  if [ -z "$APP_PATH" ]; then
    APP_PATH=$(find "$PWD/build/CBProProxy.xcarchive/Products" -name "*.app" -type d -maxdepth 1 | head -n 1)
  fi

  if [ -z "$APP_PATH" ]; then
    APP_PATH=$(find "$PWD/build/CBProProxy.xcarchive" -name "*.app" -type d | grep -v "Plugins" | head -n 1)
  fi

  if [ -z "$APP_PATH" ]; then
    echo -e "${RED}✗ Error: No .app bundle found in archive${NC}"
    exit 1
  fi

  echo -e "${GREEN}✓ Found app: $APP_PATH${NC}"

  # Copy app to Payload
  cp -r "$APP_PATH" "$PWD/build/output/Payload/"

  # Get app name
  APP_NAME=$(basename "$APP_PATH")
  echo -e "${GREEN}✓ App name: $APP_NAME${NC}"

  # Remove code signatures
  echo -e "${YELLOW}Removing code signatures...${NC}"
  find "$PWD/build/output/Payload/$APP_NAME" -name "_CodeSignature" -type d -prune -exec rm -rf {} + 2>/dev/null || true
  find "$PWD/build/output/Payload/$APP_NAME" -name "embedded.mobileprovision" -type f -exec rm -f {} + 2>/dev/null || true
  echo -e "${GREEN}✓ Code signatures removed${NC}"

  # Create IPA
  cd "$PWD/build/output"
  echo -e "${YELLOW}Zipping IPA...${NC}"
  zip -qr CBProProxy.ipa Payload
  rm -rf Payload

  # Move to project root with version name
  cd ../../..
  IPA_NAME="CBProProxy-${VERSION}-b${BUILD_NUMBER}-unsigned.ipa"
  mkdir -p "./build-output"
  IPA_PATH="./build-output/${IPA_NAME}"
  mv "ios/build/output/CBProProxy.ipa" "$IPA_PATH"

  # Get file size
  FILE_SIZE=$(ls -lh "$IPA_PATH" | awk '{print $5}')

  echo ""
  echo -e "${GREEN}==================================${NC}"
  echo -e "${GREEN}  ✓ Build completed successfully!${NC}"
  echo -e "${GREEN}==================================${NC}"
  echo ""
  echo -e "${BLUE}Output:${NC}"
  echo -e "  ${GREEN}$IPA_PATH${NC}"
  echo -e "  Size: ${FILE_SIZE}"
  echo ""
else
  # Install-only mode: IPA_PATH already set
  FILE_SIZE=$(ls -lh "$IPA_PATH" | awk '{print $5}')
  echo -e "${GREEN}Using existing IPA:${NC}"
  echo -e "  ${GREEN}$IPA_PATH${NC}"
  echo -e "  Size: ${FILE_SIZE}"
  echo ""
fi

# Installation section (works for both modes)
echo -e "${BLUE}Installation methods:${NC}"
echo -e "  • ${GREEN}TrollStore${NC}: Open IPA in TrollStore (${MAGENTA}RECOMMENDED for VPN${NC})"
echo -e "  • AltStore: Drag IPA into AltStore app (VPN will NOT work)"
echo -e "  • Sideloadly: Connect iPhone and use Sideloadly (VPN will NOT work)"
echo ""
echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${RED}⚠️  IMPORTANT: VPN Entitlements Warning${NC}"
echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}This app requires Network Extension entitlements!${NC}"
echo ""
echo -e "${GREEN}✓ Works with:${NC}"
echo -e "  • TrollStore (iOS 14.0-16.6.1) - No signing needed"
echo -e "  • Paid Apple Developer Account - Proper signing"
echo ""
echo -e "${RED}✗ Does NOT work with:${NC}"
echo -e "  • Free Apple ID (AltStore/Sideloadly)"
echo -e "  • ideviceinstaller on standard jailbreak"
echo -e "  • Unsigned IPA installation methods"
echo ""
echo -e "${YELLOW}Why? VPN requires special system entitlements that${NC}"
echo -e "${YELLOW}cannot be added without proper code signing.${NC}"
echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Ask to install on jailbroken device
if [ "$AUTO_INSTALL" = false ]; then
  echo -e "${BLUE}Try installing via ideviceinstaller anyway?${NC}"
  echo -e "  ${RED}Note: This will likely FAIL due to missing entitlements${NC}"
  echo -e "  ${YELLOW}Only works on TrollStore or with paid Developer account${NC}"
  read -p "Install now? (y/N): " -n 1 -r
  echo ""
  
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    AUTO_INSTALL=true
  fi
fi

if [ "$AUTO_INSTALL" = true ]; then
  echo ""
  echo -e "${BLUE}==================================${NC}"
  echo -e "${BLUE}  Installing to Device${NC}"
  echo -e "${BLUE}==================================${NC}"
  echo ""
  
  # Check for ideviceinstaller
  if ! command -v ideviceinstaller &> /dev/null; then
    echo -e "${RED}✗ ideviceinstaller not found${NC}"
    echo -e "${YELLOW}Install with: brew install ideviceinstaller${NC}"
    echo ""
    read -p "Install now with Homebrew? (y/N): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      if ! command -v brew &> /dev/null; then
        echo -e "${RED}✗ Homebrew not found. Please install from https://brew.sh${NC}"
        exit 1
      fi
      
      echo -e "${YELLOW}Installing ideviceinstaller...${NC}"
      brew install ideviceinstaller
      echo -e "${GREEN}✓ ideviceinstaller installed${NC}"
      echo ""
    else
      echo -e "${YELLOW}Skipping installation${NC}"
      exit 0
    fi
  fi
  
  # Check for connected devices
  echo -e "${YELLOW}Checking for connected devices...${NC}"
  DEVICE_UDID=$(idevice_id -l | head -n 1)
  
  if [ -z "$DEVICE_UDID" ]; then
    echo -e "${RED}✗ No device connected${NC}"
    echo -e "${YELLOW}Please connect your jailbroken device via USB${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}✓ Found device: $DEVICE_UDID${NC}"
  
  # Get device info
  DEVICE_NAME=$(ideviceinfo -u "$DEVICE_UDID" -k DeviceName 2>/dev/null || echo "Unknown")
  IOS_VERSION=$(ideviceinfo -u "$DEVICE_UDID" -k ProductVersion 2>/dev/null || echo "Unknown")
  echo -e "${GREEN}  Name: $DEVICE_NAME${NC}"
  echo -e "${GREEN}  iOS: $IOS_VERSION${NC}"
  echo ""
  
  # Uninstall old version if exists
  echo -e "${YELLOW}Checking for existing installation...${NC}"
  BUNDLE_ID="com.cbv.vpn"
  
  if ideviceinstaller -u "$DEVICE_UDID" -l | grep -q "$BUNDLE_ID"; then
    echo -e "${YELLOW}Found existing app, uninstalling...${NC}"
    ideviceinstaller -u "$DEVICE_UDID" -U "$BUNDLE_ID"
    echo -e "${GREEN}✓ Old version removed${NC}"
  else
    echo -e "${GREEN}✓ No existing installation found${NC}"
  fi
  echo ""
  
  # Install IPA
  echo -e "${YELLOW}Installing IPA to device...${NC}"
  echo -e "${YELLOW}This may take 1-2 minutes...${NC}"
  echo ""
  
  if ideviceinstaller -u "$DEVICE_UDID" -i "$IPA_PATH"; then
    echo ""
    echo -e "${GREEN}==================================${NC}"
    echo -e "${GREEN}  ✓ Installation successful!${NC}"
    echo -e "${GREEN}==================================${NC}"
    echo ""
    echo -e "${BLUE}App installed on: $DEVICE_NAME${NC}"
    echo -e "${YELLOW}Check your device home screen${NC}"
    echo ""
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}⚠️  VPN Profile Creation will FAIL!${NC}"
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}This IPA lacks proper entitlements.${NC}"
    echo -e "${YELLOW}Use TrollStore for full VPN functionality.${NC}"
    echo ""
  else
    echo ""
    echo -e "${RED}==================================${NC}"
    echo -e "${RED}  ✗ Installation failed${NC}"
    echo -e "${RED}==================================${NC}"
    echo ""
    echo -e "${YELLOW}Error: Missing application-identifier entitlement${NC}"
    echo ""
    echo -e "${BLUE}Why this happens:${NC}"
    echo -e "  • Unsigned IPAs lack required entitlements"
    echo -e "  • VPN apps need special Network Extension entitlements"
    echo -e "  • Standard jailbreak cannot bypass this"
    echo ""
    echo -e "${GREEN}Solutions:${NC}"
    echo -e "  ${MAGENTA}1. TrollStore (RECOMMENDED)${NC}"
    echo -e "     • iOS 14.0-16.6.1 supported"
    echo -e "     • Installs with fake entitlements"
    echo -e "     • Full VPN functionality works"
    echo -e "     • Get from: https://github.com/opa334/TrollStore"
    echo ""
    echo -e "  ${GREEN}2. Paid Apple Developer Account${NC}"
    echo -e "     • Sign IPA with Xcode"
    echo -e "     • Add proper provisioning profile"
    echo -e "     • Enable Network Extension capability"
    echo ""
    echo -e "  ${YELLOW}3. ldid (Advanced - Jailbreak only)${NC}"
    echo -e "     • Install ldid from Cydia/Sileo"
    echo -e "     • Manually add entitlements"
    echo -e "     • May not work on all iOS versions"
    echo ""
    exit 1
  fi
fi

