# 🚀 CB Pro VPN - Fastlane & GitHub Actions Setup Guide

Complete guide to setup Fastlane for automated Android build and deployment to Google Play Store using GitHub Actions.

## 📋 Table of Contents

1. [Preparation](#preparation)
2. [Create Keystore](#create-keystore)
3. [Google Play Console Setup](#google-play-console-setup)
4. [GitHub Secrets Setup](#github-secrets-setup)
5. [Local Build](#local-build)
6. [GitHub Actions Workflow](#github-actions-workflow)
7. [Screenshots](#screenshots)
8. [Troubleshooting](#troubleshooting)

---

## 🔧 Preparation

### System Requirements
```bash
# macOS
brew install fastlane
brew install --cask android-studio
brew install jq

# or install via gem
gem install fastlane
```

### Directory Structure
```
CB-Pro-Proxy/
├── android/
│   ├── fastlane/
│   │   ├── Fastfile              # Main Fastlane config
│   │   ├── Appfile               # App-specific config
│   │   ├── capture_screenshots.sh # Screenshot automation
│   │   ├── metadata/
│   │   │   └── android/
│   │   │       └── en-US/        # English metadata
│   │   │           ├── title.txt
│   │   │           ├── short_description.txt
│   │   │           ├── full_description.txt
│   │   │           └── changelog.txt
│   │   └── screenshots/          # Screenshot output directory
│   └── Gemfile                   # Ruby dependencies
├── .github/
│   └── workflows/
│       └── release-playstore.yml # GitHub Actions workflow
└── android/fastlane/README.md    # This documentation
```

---

## 🔐 Create Keystore

Keystore is used to sign APK/AAB when building releases.

### Step 1: Create keystore file

```bash
cd CB-Pro-Proxy/android

keytool -genkey -v \
  -keystore release.keystore \
  -keyalg RSA \
  -keysize 2048 \
  -validity 9125 \
  -alias cb-pro-vpn \
  -storepass your_keystore_password \
  -keypass your_key_password

# Or interactive mode
keytool -genkey -v -keystore release.keystore
```

### Step 2: Verify keystore

```bash
keytool -list -v -keystore release.keystore
```

**Notes:**
- `validity 9125` = 25 years (long enough for production)
- Save **keystore password** and **alias** - you'll need them for GitHub Secrets
- **DO NOT** commit `release.keystore` to Git!

### Step 3: Add to .gitignore

```bash
echo "release.keystore" >> .gitignore
echo "google_play_key.json" >> .gitignore
echo "local.properties" >> .gitignore
```

---

## 📱 Google Play Console Setup

### Step 1: Create Service Account

1. **Go to [Google Cloud Console](https://console.cloud.google.com)**
2. **Create a new Project** or select existing one
3. **Enable API:**
   - Click "APIs & Services" → "Enable APIs and Services"
   - Search for "Google Play Android Developer API"
   - Click Enable

4. **Create Service Account:**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "Service Account"
   - Name it: `fastlane-android`
   - Click "Create and Continue"

5. **Create Key:**
   - Click the service account you just created
   - Tab "Keys"
   - "Add Key" → "Create new key"
   - Select "JSON"
   - File `*.json` will download → **Save it safely!**

### Step 2: Grant Permissions in Google Play Console

1. **Go to [Google Play Console](https://play.google.com/console)**
2. **Select "CB Pro VPN" app**
3. **Settings** → **User and permissions**
4. **Invite user** - paste service account email
5. **Assign permissions:**
   - ✅ Release apps to testing tracks
   - ✅ Release apps to production
   - ✅ View app analytics and data
   - ✅ Manage release notes in all languages

---

## 🔑 GitHub Secrets Setup

### Step 1: Prepare Values

Prepare each value below before adding to GitHub:

```bash
# 1. Encode keystore to Base64
cd CB-Pro-Proxy/android
base64 -i release.keystore > keystore_base64.txt

# 2. Encode Google Play credentials
base64 -i ~/Downloads/your-service-account.json > play_store_base64.txt

# 3. Get keystore info
keytool -list -v -keystore release.keystore
# Save: KEYSTORE_ALIAS, KEYSTORE_PASSWORD, KEYSTORE_KEY_PASSWORD
```

### Step 2: Add Secrets to GitHub

1. **Go to GitHub Repository**
2. **Settings** → **Secrets and variables** → **Actions**
3. **New repository secret** - add each one below:

| Secret Name | Value | Description |
|-------------|-------|----------------|
| `KEYSTORE_BASE64` | (Output from `base64 -i release.keystore`) | Encoded keystore file |
| `KEYSTORE_PASSWORD` | `your_keystore_password` | Keystore password |
| `KEYSTORE_ALIAS` | `cb-pro-vpn` | Key alias in keystore |
| `KEYSTORE_KEY_PASSWORD` | `your_key_password` | Key password |
| `PLAY_STORE_JSON_BASE64` | (Output from `base64 -i *.json`) | Google Play service account |

**Example: How to add a secret:**
```bash
# Copy base64 file content
cat keystore_base64.txt | pbcopy

# Add to GitHub UI
# Settings → Secrets → New secret
# Name: KEYSTORE_BASE64
# Value: (paste from clipboard)
```

---

## 🏗️ Local Build

### Install Fastlane

```bash
cd CB-Pro-Proxy/android

# Install Ruby bundler
gem install bundler

# Install dependencies from Gemfile
bundle install
```

### Build AAB (Play Store)

```bash
cd CB-Pro-Proxy/android

# Export environment variables
export KEYSTORE_PATH="$(pwd)/release.keystore"
export KEYSTORE_PASSWORD="your_keystore_password"
export KEYSTORE_ALIAS="cb-pro-vpn"
export KEYSTORE_KEY_PASSWORD="your_key_password"

# Run fastlane lane
bundle exec fastlane android build_signed_aab
```

**Output:** `app/build/outputs/bundle/release/app-release.aab`

### Build APK (Testing)

```bash
bundle exec fastlane android build_signed_apk
```

**Output:** `app/build/outputs/apk/release/app-release.apk`

### Upload to Play Store (Manual)

```bash
export ANDROID_JSON_KEY_DATA='{"type": "service_account", ...}'

# Upload to internal track (draft)
bundle exec fastlane android release_to_playstore track:internal

# Upload to beta track
bundle exec fastlane android release_to_playstore track:beta release_status:beta

# Upload to production (careful!)
bundle exec fastlane android release_to_playstore track:production
```

---

## 🤖 GitHub Actions Workflow

### How to Trigger Workflow

#### 1️⃣ **Automatic on tag push** (Recommended)
```bash
# Tag version
git tag -a v1.0.0 -m "Release version 1.0.0"

# Push tag (automatically triggers workflow)
git push origin v1.0.0
```

Workflow will:
- ✅ Build APK + AAB
- ✅ Capture screenshots
- ✅ Upload to Play Store (production track, draft status)
- ✅ Create GitHub Release

#### 2️⃣ **Manual trigger** (Flexible)

1. GitHub → Actions → "Build & Release to Google Play Store"
2. "Run workflow" → Select:
   - Branch: `main`
   - Track: `internal` / `alpha` / `beta` / `production`
   - Build number: (optional)
3. Click "Run workflow"

#### 3️⃣ **Schedule** (Nightly builds)

Add to `.github/workflows/release-playstore.yml`:

```yaml
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM UTC daily
```

### Workflow Jobs

```
┌─────────────┐
│  Setup Env  │  Get version & build number
└──────┬──────┘
       │
    ┌──┴──┬──────────────┐
    │     │              │
    v     v              v
┌─────┐ ┌────────────┐  ┌──────────┐
│Build│ │Screenshots │  │Test APK  │
└──┬──┘ └──────┬─────┘  └──────────┘
   │          │
   └────┬─────┘
        v
   ┌─────────────────┐
   │  Deploy to PS   │ (If tag or manual)
   └────────┬────────┘
            v
   ┌─────────────────┐
   │  Notify Summary │
   └─────────────────┘
```

### Monitor Build

1. Go to **Actions** tab
2. View **"Build & Release to Google Play Store"**
3. Click job to see detailed logs
4. Each job has status badge:
   - ✅ Success
   - ❌ Failed
   - ⏳ In Progress

---

## 📸 Screenshots

### Type 1: Run Locally

```bash
cd CB-Pro-Proxy/android

# Need Android device/emulator connected
adb devices

# Run screenshot automation
bash fastlane/capture_screenshots.sh
```

**Output:** `fastlane/screenshots/en-US/` and `fastlane/screenshots/vi-VN/`

### Type 2: Automatic via GitHub Actions

Workflow will automatically:
1. Create emulator
2. Build debug APK
3. Run screenshot script
4. Save artifacts (30 days)

### Image Structure

```
fastlane/screenshots/
├── en-US/
│   ├── 1-main-connection.png
│   ├── 2-profile-list.png
│   ├── 3-create-profile.png
│   ├── 4-health-check.png
│   ├── 5-settings.png
│   └── 6-logs.png
└── vi-VN/
    ├── 1-main-connection.png
    ├── 2-profile-list.png
    └── ...
```

### Upload Screenshots

```bash
# Manual upload
cd CB-Pro-Proxy/android

export ANDROID_JSON_KEY_DATA='{"type": "service_account", ...}'

bundle exec fastlane android release_to_playstore \
  skip_upload_apk:true \
  skip_upload_aab:true \
  skip_upload_metadata:true \
  screenshots_source_dir:"fastlane/screenshots/"
```

---

## 🔄 Metadata Update

Metadata is stored at `android/fastlane/metadata/android/en-US/`:

```bash
# Files auto-uploaded
- title.txt              # 50 char max
- short_description.txt # 80 char max
- full_description.txt  # 4000 char max
- changelog.txt         # 500 char max
```

**Edit metadata:**
```bash
nano android/fastlane/metadata/android/en-US/full_description.txt
# Save & commit
git add .
git commit -m "Update Play Store metadata"
git push
```

Automatically uploads to Play Store in workflow.

---

## 📊 Version Management

### Auto Increment

```bash
# CI auto-calculates build number from timestamp
BUILD_NUMBER=$(date +%s)

# Or update app.json
cat app.json | jq '.expo.version = "1.0.1"' > app.json
```

### Manual Version

```bash
# Edit app.json
nano app.json
# Change: "version": "1.0.1"

# Commit & tag
git add app.json
git commit -m "Bump version to 1.0.1"
git tag -a v1.0.1 -m "Release 1.0.1"
git push origin main
git push origin v1.0.1
```

---

## 🚀 Production Checklist

Before releasing to production:

- [ ] Test APK on real device
- [ ] Verify all screenshots are correct
- [ ] Update changelog & metadata
- [ ] Verify app signing
- [ ] Review version number
- [ ] Run build locally first
- [ ] Commit all config files
- [ ] Tag release and push

```bash
# Final push
git add .
git commit -m "Release v1.0.0 to Play Store"
git tag -a v1.0.0 -m "Production release"
git push origin main --tags
```

---

## ❌ Troubleshooting

### ❓ "Keystore not found"
```bash
# Check file exists
ls -la CB-Pro-Proxy/android/release.keystore

# Verify keystore
keytool -list -v -keystore CB-Pro-Proxy/android/release.keystore
```

### ❓ "Invalid Google Play credentials"
```bash
# Verify service account has permissions
# Go to Google Play Console → Settings → User permissions
# Add email from JSON file with Release permission

# Test credentials locally
cat google_play_key.json | jq .
```

### ❓ "Build failed in CI"
```bash
# Check logs in Actions tab
# Verify all secrets are set: Settings → Secrets

# Test locally first
export KEYSTORE_PATH="$(pwd)/release.keystore"
export KEYSTORE_PASSWORD="xxx"
export KEYSTORE_ALIAS="xxx"
export KEYSTORE_KEY_PASSWORD="xxx"
bundle exec fastlane android build_signed_aab
```

### ❓ "Screenshots not captured"
```bash
# Verify device connected
adb devices

# Run script manually
cd CB-Pro-Proxy/android
bash fastlane/capture_screenshots.sh

# Check output
ls -la fastlane/screenshots/
```

### ❓ "APK won't install on device"
```bash
# Uninstall old version
adb uninstall com.cbv.vpn

# Install new APK
adb install -r app-release.apk

# Check logs
adb logcat | grep cbv
```

---

## 📚 References

- [Fastlane Official Docs](https://docs.fastlane.tools/)
- [Fastlane Android Docs](https://docs.fastlane.tools/actions/build_app/)
- [Google Play Upload Docs](https://docs.fastlane.tools/actions/upload_to_play_store/)
- [GitHub Actions Android Docs](https://github.com/marketplace/actions/build-android-app)
- [Android Signing Guide](https://developer.android.com/studio/publish/app-signing)

---

## 🆘 Support

If you encounter issues:

1. **Check logs** - Actions tab in GitHub
2. **Test locally** - Run Fastlane commands locally
3. **Verify secrets** - Settings → Secrets
4. **Check permissions** - Google Play Console user roles

---

**Last Updated:** December 2024  
**Version:** 1.0.0
