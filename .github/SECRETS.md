# GitHub Actions Secrets Configuration

This document describes the required secrets for building Android APK and iOS IPA in GitHub Actions.

## Android Build Secrets

### Required Secrets

1. **ANDROID_KEYSTORE_BASE64**
   - Base64 encoded Android keystore file
   - Generate: `base64 -i your-release-key.keystore | pbcopy` (macOS) or `base64 -w 0 your-release-key.keystore` (Linux)

2. **ANDROID_KEYSTORE_PASSWORD**
   - Password for the keystore file
   - Example: `your-keystore-password`

3. **ANDROID_KEY_ALIAS**
   - Alias name used when creating the key
   - Example: `my-key-alias`

4. **ANDROID_KEY_PASSWORD**
   - Password for the specific key
   - Example: `your-key-password`

### How to Create Android Keystore

```bash
# Generate a new keystore
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore release.keystore \
  -alias my-key-alias \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# Convert to base64 for GitHub Secrets
base64 -w 0 release.keystore > keystore.base64.txt
```

---

## iOS Build Secrets

### Required Secrets

1. **IOS_CERTIFICATE_BASE64**
   - Base64 encoded distribution certificate (.p12 file)
   - Generate from Apple Developer Portal
   - Convert to base64: `base64 -i Certificates.p12 | pbcopy`

2. **IOS_CERTIFICATE_PASSWORD**
   - Password used when exporting the .p12 certificate
   - Set when exporting from Keychain Access

3. **IOS_PROVISIONING_PROFILE_BASE64**
   - Base64 encoded provisioning profile (.mobileprovision file)
   - Download from Apple Developer Portal
   - Convert to base64: `base64 -i YourProfile.mobileprovision | pbcopy`

4. **IOS_PROVISIONING_PROFILE_SPECIFIER**
   - Name of the provisioning profile
   - Example: `CB Pro Proxy Distribution`
   - Found in provisioning profile details on Apple Developer Portal

5. **IOS_CODE_SIGN_IDENTITY**
   - Code signing identity name
   - Example: `iPhone Distribution: Your Company Name (TEAM_ID)`
   - Found in Keychain Access → Certificates

6. **IOS_DEVELOPMENT_TEAM**
   - Apple Developer Team ID
   - Example: `ABCDE12345`
   - Found in Apple Developer Portal → Membership

### Optional TestFlight Secrets

7. **APPLE_ID**
   - Your Apple ID email
   - Example: `developer@example.com`
   - Only needed if uploading to TestFlight

8. **FASTLANE_APP_PASSWORD**
   - App-specific password for Apple ID
   - Generate at: https://appleid.apple.com/account/manage
   - Account → Security → App-Specific Passwords

### How to Create iOS Certificates

#### 1. Create Certificate Signing Request (CSR)

1. Open **Keychain Access** on macOS
2. Menu: **Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority**
3. Enter your email and name
4. Select "Saved to disk"
5. Save as `CertificateSigningRequest.certSigningRequest`

#### 2. Create Distribution Certificate

1. Go to [Apple Developer Portal](https://developer.apple.com)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **Certificates** → **+** button
4. Select **Apple Distribution**
5. Upload the CSR file created above
6. Download the certificate (`.cer` file)
7. Double-click to install in Keychain Access

#### 3. Export Certificate as .p12

1. Open **Keychain Access**
2. Select **My Certificates**
3. Find your distribution certificate
4. Right-click → **Export "Apple Distribution: ..."**
5. Save as `.p12` format
6. Set a password (this becomes `IOS_CERTIFICATE_PASSWORD`)
7. Convert to base64:
   ```bash
   base64 -i Certificates.p12 | pbcopy
   ```

#### 4. Create Provisioning Profile

1. Go to [Apple Developer Portal](https://developer.apple.com)
2. Navigate to **Profiles** → **+** button
3. Select **App Store** (or **Ad Hoc** for testing)
4. Select your App ID (`com.cbv.vpn`)
5. Select the distribution certificate created above
6. **Important:** Enable **Network Extensions** capability
7. Name the profile (e.g., "CB Pro Proxy Distribution")
8. Download the `.mobileprovision` file
9. Convert to base64:
   ```bash
   base64 -i YourProfile.mobileprovision | pbcopy
   ```

### iOS Network Extension Requirements

⚠️ **Critical:** Your App ID must have **Network Extensions** capability enabled:

1. Go to **Identifiers** in Apple Developer Portal
2. Select your App ID (`com.cbv.vpn`)
3. Enable **Network Extensions** capability
4. Click **Save**
5. Regenerate your provisioning profiles

Without this capability, the app will fail to build or run.

---

## Adding Secrets to GitHub

### Via GitHub Web UI

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret with its name and value
5. Click **Add secret**

### Via GitHub CLI

```bash
# Android secrets
gh secret set ANDROID_KEYSTORE_BASE64 < keystore.base64.txt
gh secret set ANDROID_KEYSTORE_PASSWORD -b"your-password"
gh secret set ANDROID_KEY_ALIAS -b"your-alias"
gh secret set ANDROID_KEY_PASSWORD -b"your-password"

# iOS secrets
gh secret set IOS_CERTIFICATE_BASE64 < certificate.base64.txt
gh secret set IOS_CERTIFICATE_PASSWORD -b"your-password"
gh secret set IOS_PROVISIONING_PROFILE_BASE64 < profile.base64.txt
gh secret set IOS_PROVISIONING_PROFILE_SPECIFIER -b"CB Pro Proxy Distribution"
gh secret set IOS_CODE_SIGN_IDENTITY -b"iPhone Distribution: Company (TEAMID)"
gh secret set IOS_DEVELOPMENT_TEAM -b"ABCDE12345"

# Optional TestFlight
gh secret set APPLE_ID -b"developer@example.com"
gh secret set FASTLANE_APP_PASSWORD -b"xxxx-xxxx-xxxx-xxxx"
```

---

## Testing Locally

### Android

```bash
# Set environment variables
export ANDROID_KEYSTORE_PASSWORD="your-password"
export ANDROID_KEY_ALIAS="your-alias"
export ANDROID_KEY_PASSWORD="your-password"

# Build
cd android
./gradlew assembleRelease
```

### iOS

```bash
# Install dependencies
cd ios
pod install

# Build
xcodebuild -workspace CBVVPN.xcworkspace \
  -scheme CBVVPN \
  -configuration Release \
  archive
```

---

## Troubleshooting

### Android

**Error: "Keystore was tampered with, or password was incorrect"**
- Check `ANDROID_KEYSTORE_PASSWORD` is correct
- Verify base64 encoding didn't introduce line breaks

**Error: "Entry alias not found"**
- Check `ANDROID_KEY_ALIAS` matches the alias in keystore

### iOS

**Error: "No signing certificate found"**
- Verify certificate is installed in Keychain
- Check `IOS_CODE_SIGN_IDENTITY` matches certificate name

**Error: "Provisioning profile doesn't include signing certificate"**
- Regenerate provisioning profile with correct certificate
- Download and convert to base64 again

**Error: "Network Extensions capability required"**
- Enable in Apple Developer Portal → App ID
- Regenerate provisioning profile
- Update `IOS_PROVISIONING_PROFILE_BASE64` secret

---

## Security Best Practices

1. **Never commit secrets to repository**
2. **Rotate certificates annually**
3. **Use separate certificates for CI/CD and local development**
4. **Limit access to secrets** (only essential team members)
5. **Enable branch protection** to prevent unauthorized builds
6. **Use environment protection rules** for production releases

---

## Resources

- [Android App Signing](https://developer.android.com/studio/publish/app-signing)
- [iOS Code Signing](https://developer.apple.com/support/code-signing/)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Fastlane Documentation](https://docs.fastlane.tools/)
