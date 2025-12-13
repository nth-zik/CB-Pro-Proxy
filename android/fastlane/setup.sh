#!/bin/bash

# CB Pro VPN - GitHub Actions Setup Helper Script
# Hỗ trợ chuẩn bị và test CI/CD pipeline

set -e

echo "🚀 CB Pro VPN - GitHub Actions Setup Helper"
echo "==========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Menu
show_menu() {
    echo -e "${BLUE}Options:${NC}"
    echo "1. 🔐 Setup Keystore (tạo key mới)"
    echo "2. 📋 Encode Keystore to Base64"
    echo "3. 📱 Encode Google Play JSON"
    echo "4. 🏗️  Build locally (AAB)"
    echo "5. 📸 Capture screenshots"
    echo "6. 📤 Upload to Play Store (manual)"
    echo "7. ✅ Verify setup"
    echo "8. 📖 Show documentation"
    echo "0. ❌ Exit"
    echo ""
}

# Function: Create keystore
create_keystore() {
    echo -e "${BLUE}Creating new keystore...${NC}"
    cd android
    
    read -p "Enter keystore password: " keystore_pass
    read -p "Enter key alias (default: cb-pro-vpn): " alias
    alias=${alias:-cb-pro-vpn}
    read -p "Enter key password: " key_pass
    
    keytool -genkey -v \
        -keystore release.keystore \
        -keyalg RSA \
        -keysize 2048 \
        -validity 9125 \
        -alias "$alias" \
        -storepass "$keystore_pass" \
        -keypass "$key_pass" \
        -dname "CN=CB VPN, O=Company, C=VN"
    
    echo -e "${GREEN}✅ Keystore created successfully!${NC}"
    echo "Location: $(pwd)/release.keystore"
    echo "Alias: $alias"
    echo ""
    echo "⚠️  Save these values for GitHub Secrets:"
    echo "  - KEYSTORE_PASSWORD: $keystore_pass"
    echo "  - KEYSTORE_ALIAS: $alias"
    echo "  - KEYSTORE_KEY_PASSWORD: $key_pass"
    
    cd ..
}

# Function: Encode keystore
encode_keystore() {
    echo -e "${BLUE}Encoding keystore to Base64...${NC}"
    
    if [ ! -f "android/release.keystore" ]; then
        echo -e "${RED}❌ Keystore not found at android/release.keystore${NC}"
        return 1
    fi
    
    base64 -i android/release.keystore > /tmp/keystore_base64.txt
    
    echo -e "${GREEN}✅ Keystore encoded!${NC}"
    echo ""
    echo "Copy this value to GitHub Secret 'KEYSTORE_BASE64':"
    echo "---"
    cat /tmp/keystore_base64.txt
    echo "---"
    echo ""
}

# Function: Encode Google Play JSON
encode_play_store() {
    echo -e "${BLUE}Encoding Google Play credentials...${NC}"
    
    read -p "Enter path to Google Play service account JSON: " json_path
    
    if [ ! -f "$json_path" ]; then
        echo -e "${RED}❌ File not found: $json_path${NC}"
        return 1
    fi
    
    base64 -i "$json_path" > /tmp/play_store_base64.txt
    
    echo -e "${GREEN}✅ Google Play credentials encoded!${NC}"
    echo ""
    echo "Copy this value to GitHub Secret 'PLAY_STORE_JSON_BASE64':"
    echo "---"
    cat /tmp/play_store_base64.txt
    echo "---"
    echo ""
}

# Function: Build locally
build_locally() {
    echo -e "${BLUE}Building AAB locally...${NC}"
    
    cd android
    
    # Check keystore
    if [ ! -f "release.keystore" ]; then
        echo -e "${RED}❌ Keystore not found!${NC}"
        return 1
    fi
    
    # Get credentials
    read -sp "Keystore password: " keystore_pass
    echo ""
    read -p "Keystore alias (default: cb-pro-vpn): " alias
    alias=${alias:-cb-pro-vpn}
    read -sp "Key password: " key_pass
    echo ""
    
    # Export env vars
    export KEYSTORE_PATH="$(pwd)/release.keystore"
    export KEYSTORE_PASSWORD="$keystore_pass"
    export KEYSTORE_ALIAS="$alias"
    export KEYSTORE_KEY_PASSWORD="$key_pass"
    
    # Setup Fastlane if needed
    if ! command -v bundle &> /dev/null; then
        echo "Installing Fastlane..."
        gem install bundler
        bundle install
    fi
    
    echo ""
    echo "Building..."
    bundle exec fastlane android build_signed_aab
    
    echo -e "${GREEN}✅ Build completed!${NC}"
    echo "Output: $(pwd)/app/build/outputs/bundle/release/app-release.aab"
    
    cd ..
}

# Function: Capture screenshots
capture_screenshots() {
    echo -e "${BLUE}Capturing screenshots...${NC}"
    
    # Check device
    if ! adb devices | grep -q device; then
        echo -e "${RED}❌ No Android device/emulator found!${NC}"
        echo "Connect a device or start an emulator:"
        echo "  $ emulator -avd Pixel_4"
        return 1
    fi
    
    cd android
    bash fastlane/capture_screenshots.sh
    cd ..
    
    echo -e "${GREEN}✅ Screenshots captured!${NC}"
    echo "Location: $(pwd)/android/fastlane/screenshots/"
}

# Function: Upload to Play Store
upload_play_store() {
    echo -e "${BLUE}Uploading to Play Store...${NC}"
    
    read -p "Track (internal/alpha/beta/production): " track
    track=${track:-internal}
    
    read -p "Path to Google Play JSON: " json_path
    
    if [ ! -f "$json_path" ]; then
        echo -e "${RED}❌ File not found: $json_path${NC}"
        return 1
    fi
    
    cd android
    
    export ANDROID_JSON_KEY_DATA=$(cat "$json_path" | base64)
    
    bundle exec fastlane android release_to_playstore track:"$track"
    
    cd ..
    
    echo -e "${GREEN}✅ Upload completed!${NC}"
}

# Function: Verify setup
verify_setup() {
    echo -e "${BLUE}Verifying setup...${NC}"
    echo ""
    
    # Check keystore
    if [ -f "android/release.keystore" ]; then
        echo -e "${GREEN}✅${NC} Keystore exists"
        keytool -list -v -keystore android/release.keystore | head -5
    else
        echo -e "${RED}❌${NC} Keystore not found"
    fi
    
    echo ""
    
    # Check Fastlane
    if [ -f "android/fastlane/Fastfile" ]; then
        echo -e "${GREEN}✅${NC} Fastlane Fastfile exists"
    else
        echo -e "${RED}❌${NC} Fastlane Fastfile not found"
    fi
    
    echo ""
    
    # Check metadata
    if [ -d "android/fastlane/metadata/android/en-US" ]; then
        echo -e "${GREEN}✅${NC} Play Store metadata exists"
    else
        echo -e "${RED}❌${NC} Play Store metadata not found"
    fi
    
    echo ""
    
    # Check GitHub Actions workflow
    if [ -f ".github/workflows/release-playstore.yml" ]; then
        echo -e "${GREEN}✅${NC} GitHub Actions workflow exists"
    else
        echo -e "${RED}❌${NC} GitHub Actions workflow not found"
    fi
    
    echo ""
    
    # Check Ruby/Fastlane installed
    if command -v fastlane &> /dev/null; then
        echo -e "${GREEN}✅${NC} Fastlane installed ($(fastlane --version))"
    else
        echo -e "${RED}❌${NC} Fastlane not installed"
        echo "   Install: gem install fastlane"
    fi
}

# Function: Show documentation
show_docs() {
    echo -e "${BLUE}Opening documentation...${NC}"
    open android/fastlane/README.md
}

# Main loop
while true; do
    show_menu
    read -p "Select option: " choice
    echo ""
    
    case $choice in
        1) create_keystore ;;
        2) encode_keystore ;;
        3) encode_play_store ;;
        4) build_locally ;;
        5) capture_screenshots ;;
        6) upload_play_store ;;
        7) verify_setup ;;
        8) show_docs ;;
        0) echo "Goodbye!"; exit 0 ;;
        *) echo -e "${RED}Invalid option${NC}" ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
    clear
done
