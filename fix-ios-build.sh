#!/bin/bash

# Script to update GitHub Actions iOS build to match local build-ios-local.sh
# Fixes ldid signing for TrollStore VPN support

set -e

WORKFLOW_FILE=".github/workflows/release.yml"

echo "📝 Updating $WORKFLOW_FILE to match build-ios-local.sh..."

# Create backup
cp "$WORKFLOW_FILE" "$WORKFLOW_FILE.backup"
echo "✅ Backup created: $WORKFLOW_FILE.backup"

# Create temporary file with improved signing section
cat > /tmp/ldid-signing-section.txt << 'EOF'
          # Sign with ldid for TrollStore VPN support
          echo "🔐 Signing with ldid for TrollStore..."

          MAIN_ENTITLEMENTS="$GITHUB_WORKSPACE/ios/CBVVPN/CBVVPN.entitlements"
          EXT_ENTITLEMENTS="$GITHUB_WORKSPACE/ios/CBVVPNProxyExtension/CBVVPNProxyExtension.entitlements"
          
          # Sign main app with entitlements
          MAIN_BINARY="$PWD/build/output/Payload/$APP_NAME/$BINARY_NAME"
          echo "📱 Main binary path: $MAIN_BINARY"
          echo "📄 Main entitlements: $MAIN_ENTITLEMENTS"
          
          if [ ! -f "$MAIN_BINARY" ]; then
            echo "❌ Binary not found: $MAIN_BINARY"
            exit 1
          fi
          
          if [ ! -f "$MAIN_ENTITLEMENTS" ]; then
            echo "❌ Main app entitlements not found at: $MAIN_ENTITLEMENTS"
            exit 1
          fi
          
          echo "Signing main app: $MAIN_BINARY"
          ldid "-S$MAIN_ENTITLEMENTS" "$MAIN_BINARY"
          echo "✅ Main app signed"
          
          # Verify signing
          echo "Verifying main app signature..."
          ldid -e "$MAIN_BINARY" > /tmp/main-ent-check.xml
          if [ -s /tmp/main-ent-check.xml ]; then
            echo "✅ Main app entitlements verified:"
            cat /tmp/main-ent-check.xml | head -15
            rm /tmp/main-ent-check.xml
          else
            echo "❌ Main app entitlements NOT found!"
            exit 1
          fi

          # Sign extensions
          if [ -d "$PWD/build/output/Payload/$APP_NAME/PlugIns" ]; then
            for EXTENSION in "$PWD/build/output/Payload/$APP_NAME/PlugIns"/*.appex; do
              if [ -d "$EXTENSION" ]; then
                EXT_NAME=$(basename "$EXTENSION" .appex)
                EXT_BINARY="$EXTENSION/$EXT_NAME"
                
                echo "📱 Extension: $EXT_NAME"
                echo "📄 Binary: $EXT_BINARY"
                
                if [ ! -f "$EXT_BINARY" ]; then
                  echo "❌ Extension binary not found: $EXT_BINARY"
                  continue
                fi
                
                if [ ! -f "$EXT_ENTITLEMENTS" ]; then
                  echo "❌ Extension entitlements not found at: $EXT_ENTITLEMENTS"
                  continue
                fi
                
                echo "Signing extension: $EXT_NAME"
                ldid "-S$EXT_ENTITLEMENTS" "$EXT_BINARY"
                echo "✅ Extension signed: $EXT_NAME"
                
                # Verify signing
                echo "Verifying extension signature..."
                ldid -e "$EXT_BINARY" > /tmp/ext-ent-check.xml
                if [ -s /tmp/ext-ent-check.xml ]; then
                  echo "✅ Extension entitlements verified"
                  rm /tmp/ext-ent-check.xml
                else
                  echo "❌ Extension entitlements NOT found!"
                fi
              fi
            done
          else
            echo "⚠️  No PlugIns directory found"
          fi
EOF

# Use awk to replace the section between the markers
awk '
  BEGIN { in_section = 0; printed_new = 0 }
  /# Sign with ldid for TrollStore VPN support/ {
    if (!printed_new) {
      while (getline line < "/tmp/ldid-signing-section.txt") {
        print line
      }
      printed_new = 1
    }
    in_section = 1
    next
  }
  /# Remove Apple code signatures/ {
    in_section = 0
  }
  !in_section { print }
' "$WORKFLOW_FILE.backup" > "$WORKFLOW_FILE"

echo "✅ Updated signing section in $WORKFLOW_FILE"
echo ""
echo "📋 Changes made:"
echo "  ✓ Added explicit error checking for binary and entitlements files"
echo "  ✓ Added full verification with error messages for main app"
echo "  ✓ Added full verification for extension signing"
echo "  ✓ Added debug output for paths and files"
echo "  ✓ Exits with error if critical files missing"
echo ""
echo "🔍 To review changes:"
echo "  diff -u $WORKFLOW_FILE.backup $WORKFLOW_FILE"
echo ""
echo "✅ Done! The iOS build in GitHub Actions now matches build-ios-local.sh"

# Cleanup
rm /tmp/ldid-signing-section.txt
