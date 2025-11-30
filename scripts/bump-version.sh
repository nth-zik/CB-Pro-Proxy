#!/bin/bash

# =============================================================================
# Bump Version Script
# Usage: ./scripts/bump-version.sh [major|minor|patch]
# Default: patch
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the bump type (default: patch)
BUMP_TYPE=${1:-patch}

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
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}✅ Version bumped successfully!${NC}"
echo -e "${GREEN}============================================${NC}"
echo -e "${YELLOW}   Old version: ${CURRENT_VERSION}${NC}"
echo -e "${GREEN}   New version: ${NEW_VERSION}${NC}"
echo -e "${BLUE}   Git tag: ${NEW_TAG}${NC}"
echo ""
echo -e "${YELLOW}📤 To push changes and tag:${NC}"
echo -e "   git push && git push --tags"
echo ""
