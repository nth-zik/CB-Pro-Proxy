#!/bin/bash

# Screenshot automation script for CB Pro VPN
# This script automates taking screenshots on different device sizes

set -e

PACKAGE="com.cbv.vpn"
ACTIVITY="com.cbv.vpn.MainActivity"
SCREENSHOTS_DIR="fastlane/screenshots"

# Create directories for different locales
mkdir -p "$SCREENSHOTS_DIR/en-US"
mkdir -p "$SCREENSHOTS_DIR/vi-VN"

# Device configurations (name, resolution)
declare -a DEVICES=(
    "phone-6.7-inch:1440x3120"
    "phone-6.1-inch:1284x2778"
    "phone-5.5-inch:1080x1920"
)

echo "📱 Starting screenshot capture..."

# Wait for device
echo "⏳ Waiting for device..."
adb wait-for-device

# Check if app is installed
if ! adb shell pm list packages | grep -q "^package:$PACKAGE$"; then
    echo "❌ App not installed. Installing..."
    adb install -r app/build/outputs/apk/debug/app-debug.apk
fi

# Restart app to ensure clean state
echo "🔄 Restarting app..."
adb shell am force-stop $PACKAGE
sleep 1
adb shell am start -n $PACKAGE/$ACTIVITY
sleep 3

# Function to capture screenshot
capture_screenshot() {
    local screen_number=$1
    local screen_name=$2
    local locale=$3
    
    echo "📸 Capturing screenshot $screen_number: $screen_name (Locale: $locale)"
    
    local filename="${SCREENSHOTS_DIR}/${locale}/${screen_number}-${screen_name}.png"
    
    # Take screenshot
    adb exec-out screencap -p > "$filename"
    
    # Verify file was created
    if [ -f "$filename" ]; then
        echo "✅ Saved: $filename"
    else
        echo "❌ Failed to capture: $filename"
    fi
}

# Function to perform screen action
perform_action() {
    local action=$1
    local params=$2
    
    case $action in
        "tap")
            local x=$(echo $params | cut -d, -f1)
            local y=$(echo $params | cut -d, -f2)
            adb shell input tap $x $y
            ;;
        "swipe")
            local x1=$(echo $params | cut -d, -f1)
            local y1=$(echo $params | cut -d, -f2)
            local x2=$(echo $params | cut -d, -f3)
            local y2=$(echo $params | cut -d, -f4)
            adb shell input swipe $x1 $y1 $x2 $y2
            ;;
        "text")
            adb shell input text "$params"
            ;;
        "sleep")
            sleep $params
            ;;
    esac
}

# Screenshot sequences for English locale
echo ""
echo "📷 Capturing English screenshots..."

# Screen 1: Main Connection Screen
perform_action "sleep" "2"
capture_screenshot "1" "main-connection" "en-US"

# Screen 2: Profile List
perform_action "tap" "540,500"  # Tap profile section
perform_action "sleep" "1"
capture_screenshot "2" "profile-list" "en-US"

# Screen 3: Create Profile
perform_action "tap" "540,100"  # Tap create button
perform_action "sleep" "1"
capture_screenshot "3" "create-profile" "en-US"

# Screen 4: Health Check
perform_action "tap" "540,300"  # Tap health check
perform_action "sleep" "2"
capture_screenshot "4" "health-check" "en-US"

# Screen 5: Settings
perform_action "tap" "50,50"    # Tap settings/menu
perform_action "sleep" "1"
capture_screenshot "5" "settings" "en-US"

# Screen 6: Logs
perform_action "tap" "540,600"  # Tap logs section
perform_action "sleep" "1"
capture_screenshot "6" "logs" "en-US"

# Go back to main screen
adb shell am start -n $PACKAGE/$ACTIVITY
perform_action "sleep" "2"

# If Vietnamese locale is available, capture those too
echo ""
echo "📷 Attempting to capture Vietnamese screenshots..."

# Change device language to Vietnamese
adb shell settings put system user_preferred_language vi-VN 2>/dev/null || true
perform_action "sleep" "2"

# Repeat screenshot sequence
capture_screenshot "1" "main-connection" "vi-VN"
perform_action "tap" "540,500"
perform_action "sleep" "1"
capture_screenshot "2" "profile-list" "vi-VN"
perform_action "tap" "540,100"
perform_action "sleep" "1"
capture_screenshot "3" "create-profile" "vi-VN"

# Reset language
adb shell settings put system user_preferred_language en-US 2>/dev/null || true

echo ""
echo "✅ Screenshot capture complete!"
echo ""
echo "📁 Screenshots saved to:"
echo "  - ${SCREENSHOTS_DIR}/en-US/"
echo "  - ${SCREENSHOTS_DIR}/vi-VN/"
echo ""
echo "📋 Next steps:"
echo "  1. Review screenshots in the directories above"
echo "  2. Rename/organize as needed for Play Store"
echo "  3. Run: fastlane android upload_screenshots"
