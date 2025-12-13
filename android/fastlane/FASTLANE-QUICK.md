# FASTLANE - Quick Setup (Minimal Steps)

Mục tiêu: các bước ngắn gọn, đủ để cấu hình build Android (AAB/APK) với Fastlane + GitHub Actions.

1) Cài đặt môi trường (macOS / local)
```bash
# macOS
brew install fastlane
brew install --cask android-studio
brew install jq
# hoặc nếu không dùng homebrew
gem install fastlane
```

2) Tạo keystore (release)
```bash
cd android
keytool -genkey -v -keystore release.keystore -alias cb-pro-vpn -keyalg RSA -keysize 2048 -validity 9125
# Ghi nhớ: alias, keystore password, key password
```

3) Tạo Service Account Google Play + JSON key
- Google Cloud Console → APIs & Services → Enable "Google Play Android Developer API"
- Create Service Account (name: `fastlane-android`) → Add key (JSON)
- Trong Google Play Console (App) → Settings → User & permissions → Invite service account email, gán quyền Release & Manage releases

4) Bảo mật (GitHub Secrets)
- Encode keystore & JSON trước khi thêm vào secret:
```bash
cd android
base64 -i release.keystore > keystore_base64.txt
base64 -i /path/to/your-service-account.json > play_store_base64.txt
```
- Thêm vào GitHub repo → Settings → Secrets and variables → Actions:
  - KEYSTORE_BASE64 → (nội dung keystore_base64.txt)
  - KEYSTORE_PASSWORD → (keystore password)
  - KEYSTORE_ALIAS → cb-pro-vpn
  - KEYSTORE_KEY_PASSWORD → (key password)
  - PLAY_STORE_JSON_BASE64 → (nội dung play_store_base64.txt)

5) Fastlane files (sẵn có trong repo):
- `Fastfile` - lanes: build_signed_aab, build_signed_apk, release_to_playstore
- `Appfile` - package name, (có thể để ENV vars cho json)
- `capture_screenshots.sh` - script capture screenshots (optional)

6) Cài dependencies Ruby (bundle)
```bash
cd android
gem install bundler
bundle install
```

7) Build locally (test)
```bash
cd android
# export env vars để fastlane đọc
export KEYSTORE_PATH="$(pwd)/release.keystore"
export KEYSTORE_PASSWORD="your_keystore_password"
export KEYSTORE_ALIAS="cb-pro-vpn"
export KEYSTORE_KEY_PASSWORD="your_key_password"
# Build AAB
bundle exec fastlane android build_signed_aab
# Build APK (testing)
bundle exec fastlane android build_signed_apk
```

8) Upload Manual (fastlane lane)
- Set environment var OR use `ANDROID_JSON_KEY_DATA` to pass JSON
```bash
export ANDROID_JSON_KEY_DATA='{"type": "service_account", ...}'
# Upload to internal
bundle exec fastlane android release_to_playstore track:internal
```

9) Trigger CI/CD (GitHub Actions)
- Recommended: create a Tag and push (git tag v1.0.0; git push origin v1.0.0)
- Or: Actions → Workflow → Run workflow → chọn track & branch
- Workflow sẽ decode secrets, chạy fastlane lanes và upload lên Google Play

10) Tips & warnings
- KHÔNG để file `release.keystore` hoặc JSON key trong repo
- Kiểm tra logs: GitHub Actions → job logs
- Kiểm tra permission service account trong Play Console nếu lỗi credentials

---

Cần thêm? Nếu muốn mình có thể tạo 1 file mẫu `fastlane/.env.example` hoặc `setup.sh` để tự động encode secrets và hiển thị các lệnh cần thiết.