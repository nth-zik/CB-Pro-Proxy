# GitHub Actions Workflows - CB Pro Proxy

Complete guide for automated build and deployment workflows.

## 📋 Table of Contents

- [Build iOS (Sideload)](#build-ios-sideload)
- [Build Android + iOS Release](#build-release)
- [Deploy to Google Play Store](#deploy-to-google-play-store)

---

## 🍎 Build iOS (Sideload)

**File**: `build-ios.yml`

This workflow creates unsigned IPA files for installation via AltStore, Sideloadly, or TrollStore.

### When does it run?

- Automatically on push to `main` (if iOS files changed)
- Manual trigger via "Actions" tab

### Output

- `CBProProxy-{version}-b{build_number}-unsigned.ipa`
- Compatible with: AltStore, Sideloadly, TrollStore, Scarlet

### ⚠️ Important Notes for iOS

#### VPN Functionality

**VPN features require Network Extension entitlements**, which are **NOT available** with free Apple ID signing (AltStore/Sideloadly default).

**To use VPN features, you need ONE of these:**

1. **TrollStore (RECOMMENDED)** ✅
   - Supports iOS 14.0-16.6.1
   - Permanent install without re-signing
   - Full VPN functionality works
   - Install: [TrollStore Guide](https://ios.cfw.guide/installing-trollstore/)

2. **AltStore with Paid Apple Developer Account** ($99/year)
   - Sign in with Developer Account in AltStore
   - Full Network Extension support

3. **Sideloadly with Paid Apple Developer Account**
   - Use Developer Account credentials
   - VPN will work properly

**With Free Apple ID:** App installs but VPN profile creation will fail. Other proxy features may still work with limitations.

---

## 📦 Build Release (Android + iOS)

**File**: `release.yml`

Builds both Android APK and iOS IPA simultaneously when creating a release tag.

### Usage

#### 1. Create automatic release (recommended)

```bash
git tag v1.2.3
git push origin v1.2.3
```

#### 2. Or manual trigger

- Go to "Actions" → "Build Release" → "Run workflow"
- Enter version (e.g., `1.2.3`)
- Choose to deploy to Play Store (optional)

### Output

- `cbv-vpn-v{version}.apk` - Android APK
- `CBProProxy-{version}-unsigned.ipa` - iOS IPA
- GitHub Release with both files

---

## 🏪 Deploy to Google Play Store

**File**: `release-playstore.yml`

Complete workflow to build AAB, capture screenshots, and deploy to Google Play Store.

### 🔑 Prerequisites

#### 1. **Android Keystore**

Keystore file for signing Android apps.

**Create new keystore** (if you don't have one):

```bash
keytool -genkeypair -v \
  -keystore release.keystore \
  -alias cbv-vpn-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass YourStorePassword \
  -keypass YourKeyPassword
```

**Convert to base64**:

```bash
base64 -i release.keystore | pbcopy
```

#### 2. **Google Play Service Account**

**Create service account**:

1. Go to [Google Play Console](https://play.google.com/console)
2. **Setup** → **API access**
3. Click **Create new service account**
4. Follow link to Google Cloud Console
5. Create service account with role **Service Account User**
6. Create JSON key and download

**Convert JSON key to base64**:

```bash
base64 -i google_play_key.json | pbcopy
```

#### 3. **Fastlane Setup**

Ensure these files exist in `android/fastlane/`:

**`Fastfile`**:

```ruby
default_platform(:android)

platform :android do
  desc "Build signed AAB for Play Store"
  lane :build_signed_aab do
    gradle(
      task: "bundle",
      build_type: "Release",
      properties: {
        "android.injected.signing.store.file" => ENV["KEYSTORE_PATH"],
        "android.injected.signing.store.password" => ENV["KEYSTORE_PASSWORD"],
        "android.injected.signing.key.alias" => ENV["KEYSTORE_ALIAS"],
        "android.injected.signing.key.password" => ENV["KEYSTORE_KEY_PASSWORD"],
      }
    )
  end

  desc "Build signed APK for testing"
  lane :build_signed_apk do
    gradle(
      task: "assemble",
      build_type: "Release",
      properties: {
        "android.injected.signing.store.file" => ENV["KEYSTORE_PATH"],
        "android.injected.signing.store.password" => ENV["KEYSTORE_PASSWORD"],
        "android.injected.signing.key.alias" => ENV["KEYSTORE_ALIAS"],
        "android.injected.signing.key.password" => ENV["KEYSTORE_KEY_PASSWORD"],
      }
    )
  end

  desc "Capture screenshots for Play Store"
  lane :capture_screenshots do
    screengrab(
      app_package_name: "com.cbv.vpn",
      locales: ["en-US", "vi-VN"],
      clear_previous_screenshots: true
    )
  end

  desc "Deploy to Google Play Store"
  lane :release_to_playstore do |options|
    supply(
      track: options[:track] || "internal",
      release_status: options[:release_status] || "draft",
      aab: "app/build/outputs/bundle/release/app-release.aab",
      json_key: "google_play_key.json",
      package_name: "com.cbv.vpn",
      skip_upload_metadata: false,
      skip_upload_images: false,
      skip_upload_screenshots: false
    )
  end
end
```

**`Appfile`**:

```ruby
json_key_file("google_play_key.json")
package_name("com.cbv.vpn")
```

### 🔐 GitHub Secrets Setup

Go to **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret Name                 | Value                            | Description                      |
| --------------------------- | -------------------------------- | -------------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | Base64 of `release.keystore`     | Keystore for signing APK/AAB     |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password                | Password for keystore file       |
| `ANDROID_KEY_ALIAS`         | Key alias                        | Usually the key name in keystore |
| `ANDROID_KEY_PASSWORD`      | Key password                     | Password for key alias           |
| `PLAY_STORE_JSON_BASE64`    | Base64 of `google_play_key.json` | Service account credentials      |
| `SLACK_WEBHOOK_URL`         | Webhook URL (optional)           | For Slack notifications          |

**Verify secrets are correct**:

```bash
# Test decode keystore
echo $ANDROID_KEYSTORE_BASE64 | base64 -d > test.keystore
file test.keystore  # Should show: "Java KeyStore"

# Test decode Play Store JSON
echo $PLAY_STORE_JSON_BASE64 | base64 -d > test.json
cat test.json  # Should show valid JSON with service account info
```

### 🚀 Running the workflow

#### Option 1: Manual Trigger (Recommended)

1. Go to **Actions** tab
2. Click **Build & Release to Google Play Store**
3. Click **Run workflow**
4. Select options:
   - **track**: `internal` / `alpha` / `beta` / `production`
   - **build_number**: Leave empty for auto-generate

#### Option 2: From command line

```bash
gh workflow run release-playstore.yml \
  -f track=internal \
  -f build_number=12345
```

### 📊 Release Tracks

| Track          | Description      | Who can test?                |
| -------------- | ---------------- | ---------------------------- |
| **Internal**   | Internal testing | Tester list (max 100 people) |
| **Alpha**      | Closed testing   | Tester groups                |
| **Beta**       | Open testing     | Public with link             |
| **Production** | Official release | All users                    |

**Recommended workflow**:

1. Deploy `internal` → Internal testing
2. Promote to `alpha` → Wider testing group
3. Promote to `beta` → Public beta
4. Promote to `production` → Official release

### 📸 Screenshots

Workflow automatically captures screenshots for Play Store listing.

**Setup screenshot tests**:

`android/fastlane/Screengrabfile`:

```ruby
app_package_name('com.cbv.vpn')
use_tests_in_packages(['com.cbv.vpn.screenshots'])

locales(['en-US', 'vi-VN'])

clear_previous_screenshots(true)

app_apk_path('app/build/outputs/apk/debug/app-debug.apk')
tests_apk_path('app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk')
```

Create test class:

```kotlin
// android/app/src/androidTest/java/com/cbv/vpn/screenshots/ScreenshotTest.kt
@RunWith(JUnit4::class)
class ScreenshotTest {
    @get:Rule
    val activityRule = ActivityScenarioRule(MainActivity::class.java)

    @Test
    fun captureScreenshots() {
        Screengrab.screenshot("1_main_screen")

        // Navigate and capture more screens
        onView(withId(R.id.connect_button)).perform(click())
        Thread.sleep(1000)
        Screengrab.screenshot("2_connecting")
    }
}
```

### 🔍 Monitoring & Debugging

#### Check workflow status

```bash
gh run list --workflow=release-playstore.yml
gh run view <run-id> --log
```

#### Common issues

**1. "ANDROID_KEYSTORE_BASE64 secret not found"**

- Check if secret was added
- Ensure secret name is correct (case-sensitive)

**2. "Failed to decode keystore"**

```bash
# Verify base64 encoding
base64 -d release.keystore | base64 | diff - <(cat release.keystore | base64)
```

**3. "Google Play API error"**

- Has the service account been granted permissions?
- Check in Play Console → API Access
- Required permissions: **Release manager** or **Admin**

**4. Screenshots fail**

- Emulator timeout → Increase `emulator-boot-timeout`
- Test APK build fails → Check test code
- Screengrab can't find test → Check package name

### 📝 Post-deployment

After workflow completes:

1. **Check Play Console**
   - Go to [Play Console](https://play.google.com/console)
   - **Release** → **Testing** → Select track
   - Release will be in **Draft** status

2. **Review & Publish**
   - Check uploaded APK/AAB
   - Review release notes
   - Click **Review release** → **Start rollout**

3. **Monitor rollout**
   - **Release dashboard** to view rollout progress
   - **Crashes & ANRs** to monitor stability
   - **User feedback** to read reviews

### 🎯 Tips & Best Practices

1. **Always test on Internal track first**

   ```bash
   gh workflow run release-playstore.yml -f track=internal
   ```

2. **Use staged rollout for production**
   - Start 5% → 10% → 20% → 50% → 100%
   - Monitor crash rate after each stage

3. **Automated release notes**
   - Add changelog to `android/fastlane/metadata/android/en-US/changelogs/`
   - Format: `<version_code>.txt`

4. **Version management**
   - Version name from `app.json` (e.g., `1.2.3`)
   - Build number: timestamp or manual input

5. **Quick rollback**
   - Keep APK artifacts for 30 days
   - Can re-deploy old version from artifacts

### 🔗 Resources

- [Fastlane for Android](https://docs.fastlane.tools/getting-started/android/setup/)
- [Google Play Console API](https://developers.google.com/android-publisher)
- [Screengrab Documentation](https://docs.fastlane.tools/getting-started/android/screenshots/)
- [GitHub Actions Docs](https://docs.github.com/en/actions)

---

## 📞 Support

Having issues? Check:

1. [GitHub Actions logs](../../actions)
2. [Issues tab](../../issues)
3. This workflow README

**Happy deploying! 🚀**
