#!/bin/bash

# =============================================================================
# Bump Version Script
# Usage: ./scripts/bump-version.sh [major|minor|patch] [--yes|-y]
# Default: patch
# Options:
#   --yes, -y:   Skip confirmation prompt
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
BUMP_TYPE="patch"
SKIP_CONFIRM=false

for arg in "$@"; do
  case $arg in
    major|minor|patch)
      BUMP_TYPE=$arg
      ;;
    --yes|-y)
      SKIP_CONFIRM=true
      ;;
    *)
      echo -e "${RED}❌ Invalid argument: $arg${NC}"
      echo "Usage: $0 [major|minor|patch] [--yes|-y]"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}🔍 Getting current version from git tags...${NC}"

# Get the latest version tag
CURRENT_VERSION=$(git describe --tags --abbrev=0 2>/dev/null || echo "v1.0.0")
CURRENT_VERSION=${CURRENT_VERSION#v} # Remove 'v' prefix if exists

echo -e "${YELLOW}📌 Current version: ${CURRENT_VERSION}${NC}"

# Parse version components
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Bump version based on type
case $BUMP_TYPE in
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    ;;
  patch)
    PATCH=$((PATCH + 1))
    ;;
  *)
    echo -e "${RED}❌ Invalid bump type: $BUMP_TYPE${NC}"
    echo "Usage: $0 [major|minor|patch]"
    exit 1
    ;;
esac

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
NEW_TAG="v${NEW_VERSION}"

echo -e "${GREEN}🚀 New version: ${NEW_VERSION}${NC}"
echo ""

# Calculate Android versionCode for preview
GRADLE_FILE="android/app/build.gradle"
PREVIEW_VERSION_CODE=""
if [ -f "$GRADLE_FILE" ]; then
  CURRENT_VERSION_CODE=$(grep -o 'versionCode [0-9]*' "$GRADLE_FILE" | head -1 | awk '{print $2}')
  PREVIEW_VERSION_CODE=$((CURRENT_VERSION_CODE + 1))
fi

# Show summary of changes
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        📋 Summary of Changes          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo -e "  ${YELLOW}Bump type:${NC}       ${BUMP_TYPE}"
echo -e "  ${YELLOW}Old version:${NC}     ${CURRENT_VERSION}"
echo -e "  ${GREEN}New version:${NC}     ${NEW_VERSION}"
echo -e "  ${BLUE}Git tag:${NC}         ${NEW_TAG}"
if [ -n "$PREVIEW_VERSION_CODE" ]; then
  echo -e "  ${YELLOW}Android code:${NC}    ${CURRENT_VERSION_CODE} → ${PREVIEW_VERSION_CODE}"
fi
echo ""
echo -e "${YELLOW}📝 Files to be updated:${NC}"
[ -f "app.json" ] && echo "  • app.json"
[ -f "package.json" ] && echo "  • package.json"
[ -f "$GRADLE_FILE" ] && echo "  • android/app/build.gradle"
echo ""

# Confirmation prompt
if [ "$SKIP_CONFIRM" = false ]; then
  echo -e "${YELLOW}⚠️  This will:${NC}"
  echo "  1. Update version in project files"
  echo "  2. Commit changes with message: 'chore: bump version to ${NEW_VERSION}'"
  echo "  3. Create git tag: ${NEW_TAG}"
  echo "  4. Trigger automatic deployment to Play Store (internal track) when pushed"
  echo ""
  read -p "$(echo -e ${GREEN}Do you want to continue? [y/N]:${NC} )" -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Version bump cancelled${NC}"
    exit 1
  fi
  echo ""
fi

# Update app.json
APP_JSON="app.json"
if [ -f "$APP_JSON" ]; then
  echo -e "${BLUE}📝 Updating app.json...${NC}"
  # Use sed to update version in app.json
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"${NEW_VERSION}\"/" "$APP_JSON"
  else
    # Linux
    sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"${NEW_VERSION}\"/" "$APP_JSON"
  fi
  echo -e "${GREEN}✅ Updated app.json${NC}"
fi

# Update package.json
PACKAGE_JSON="package.json"
if [ -f "$PACKAGE_JSON" ]; then
  echo -e "${BLUE}📝 Updating package.json...${NC}"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"${NEW_VERSION}\"/" "$PACKAGE_JSON"
  else
    sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"${NEW_VERSION}\"/" "$PACKAGE_JSON"
  fi
  echo -e "${GREEN}✅ Updated package.json${NC}"
fi

# Update Android versionName in build.gradle
GRADLE_FILE="android/app/build.gradle"
if [ -f "$GRADLE_FILE" ]; then
  echo -e "${BLUE}📝 Updating Android build.gradle...${NC}"
  
  # Calculate versionCode (increment by 1)
  CURRENT_VERSION_CODE=$(grep -o 'versionCode [0-9]*' "$GRADLE_FILE" | head -1 | awk '{print $2}')
  NEW_VERSION_CODE=$((CURRENT_VERSION_CODE + 1))
  
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/versionCode [0-9]*/versionCode ${NEW_VERSION_CODE}/" "$GRADLE_FILE"
    sed -i '' "s/versionName \"[^\"]*\"/versionName \"${NEW_VERSION}\"/" "$GRADLE_FILE"
  else
    sed -i "s/versionCode [0-9]*/versionCode ${NEW_VERSION_CODE}/" "$GRADLE_FILE"
    sed -i "s/versionName \"[^\"]*\"/versionName \"${NEW_VERSION}\"/" "$GRADLE_FILE"
  fi
  echo -e "${GREEN}✅ Updated build.gradle (versionCode: ${NEW_VERSION_CODE}, versionName: ${NEW_VERSION})${NC}"
fi

# Stage changes
echo -e "${BLUE}📦 Staging changes...${NC}"
git add -A

# Commit changes
echo -e "${BLUE}💾 Committing changes...${NC}"
git commit -m "chore: bump version to ${NEW_VERSION}"

# Create git tag
echo -e "${BLUE}🏷️  Creating git tag ${NEW_TAG}...${NC}"
git tag -a "$NEW_TAG" -m "Release ${NEW_VERSION}"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ Version Bumped Successfully! 🎉   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo -e "  ${YELLOW}Old version:${NC}  ${CURRENT_VERSION}"
echo -e "  ${GREEN}New version:${NC}  ${NEW_VERSION}"
echo -e "  ${BLUE}Git tag:${NC}      ${NEW_TAG}"
echo ""
echo -e "${YELLOW}📤 Next steps:${NC}"
echo -e "   ${BLUE}1.${NC} Review changes: ${BLUE}git log -1${NC}"
echo -e "   ${BLUE}2.${NC} Push to remote: ${GREEN}git push && git push --tags${NC}"
echo ""
echo -e "${YELLOW}💡 Tip:${NC} The tag '${NEW_TAG}' will trigger:"
echo -e "   • Build APK and IPA files"
echo -e "   • Create GitHub release"
echo -e "   ${GREEN}• Deploy to Google Play Store (internal track)${NC}"
echo ""
