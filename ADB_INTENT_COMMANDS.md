# ADB Intent Commands - VPN Control

Guide for controlling the VPN app via ADB intents (automation, scripts, remote control).

## Table of Contents

- [Add VPN Profile](#add-vpn-profile)
- [Start VPN by Profile Name](#start-vpn-by-profile-name)
- [Start VPN by Profile ID](#start-vpn-by-profile-id)
- [Stop VPN](#stop-vpn)
- [Get VPN Status](#get-vpn-status)
- [Automation Examples](#automation-examples)

---

## Add VPN Profile

Adds a new profile or updates an existing one (matching name).

### Syntax

```bash
adb shell am broadcast \
  -a com.cbv.vpn.ADD_PROFILE \
  --es profile_name "PROFILE_NAME" \
  --es profile_host "PROXY_HOST" \
  --ei profile_port PORT \
  --es profile_type "socks5|http" \
  [--es profile_username "USERNAME"] \
  [--es profile_password "PASSWORD"] \
  [--es profile_dns1 "DNS1"] \
  [--es profile_dns2 "DNS2"]
```

### Parameters

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `profile_name` | String | ✅ | Profile name (unique) | - |
| `profile_host` | String | ✅ | Proxy server address (IP or hostname) | - |
| `profile_port` | Integer | ❌ | Proxy port | 1080 |
| `profile_type` | String | ❌ | Proxy type: `socks5` or `http` | socks5 |
| `profile_username` | String | ❌ | Username for proxy authentication | "" |
| `profile_password` | String | ❌ | Password for proxy authentication | "" |
| `profile_dns1` | String | ❌ | Primary DNS server | 1.1.1.1 |
| `profile_dns2` | String | ❌ | Secondary DNS server | 8.8.8.8 |

### Examples

#### SOCKS5 proxy without authentication

```bash
adb shell am broadcast \
  -a com.cbv.vpn.ADD_PROFILE \
  --es profile_name "My SOCKS5 Server" \
  --es profile_host "192.168.1.100" \
  --ei profile_port 1080 \
  --es profile_type "socks5"
```

#### SOCKS5 proxy with authentication

```bash
adb shell am broadcast \
  -a com.cbv.vpn.ADD_PROFILE \
  --es profile_name "Secure SOCKS5" \
  --es profile_host "proxy.example.com" \
  --ei profile_port 1080 \
  --es profile_type "socks5" \
  --es profile_username "myuser" \
  --es profile_password "mypass123"
```

#### HTTP proxy with custom DNS

```bash
adb shell am broadcast \
  -a com.cbv.vpn.ADD_PROFILE \
  --es profile_name "HTTP Proxy" \
  --es profile_host "10.0.0.50" \
  --ei profile_port 8080 \
  --es profile_type "http" \
  --es profile_dns1 "8.8.8.8" \
  --es profile_dns2 "8.8.4.4"
```

---

## Start VPN by Profile Name

Connects using a saved profile (lookup by name).

### Syntax

```bash
adb shell am broadcast \
  -a com.cbv.vpn.START_VPN_BY_NAME \
  --es profile_name "TÊN_PROFILE"
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `profile_name` | String | ✅ | Name of the profile to activate |

### Example

```bash
# Kích hoạt profile "My SOCKS5 Server"
adb shell am broadcast \
  -a com.cbv.vpn.START_VPN_BY_NAME \
  --es profile_name "My SOCKS5 Server"
```

### Notes

- The profile must exist (add it first via `ADD_PROFILE`).
- If VPN permission has never been granted, the user must approve the dialog on-device.
- Once permission is granted, future connections run automatically.

---

## Start VPN by Profile ID

Connects using the profile ID (instead of name).

### Syntax

```bash
adb shell am broadcast \
  -a com.cbv.vpn.START_VPN_BY_ID \
  --es profile_id "PROFILE_ID"
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `profile_id` | String | ✅ | Profile ID (timestamp when created) |

### Example

```bash
adb shell am broadcast \
  -a com.cbv.vpn.START_VPN_BY_ID \
  --es profile_id "1699876543210"
```

### Getting the Profile ID

The ID is returned when the profile is created or can be read from the app/SharedPreferences:

```bash
adb shell run-as com.cbv.vpn cat /data/data/com.cbv.vpn/shared_prefs/vpn_prefs.xml
```

---

## Stop VPN

Disconnects the current VPN session.

### Syntax

```bash
adb shell am broadcast -a com.cbv.vpn.STOP_VPN
```

### Ví dụ

```bash
# Dừng VPN
adb shell am broadcast -a com.cbv.vpn.STOP_VPN
```

---

## Get VPN Status

Requests the VPN service to broadcast the current status.

### Syntax

```bash
adb shell am broadcast -a com.cbv.vpn.GET_STATUS
```

### Ví dụ

```bash
# Kiểm tra trạng thái
adb shell am broadcast -a com.cbv.vpn.GET_STATUS

# Xem log để thấy trạng thái
adb logcat -s VPNIntentReceiver VPNConnectionService VPNModule
```

---

## Automation Examples

### Script 1: Add and start a VPN profile

```bash
#!/bin/bash

PROFILE_NAME="Auto VPN"
PROXY_HOST="192.168.1.100"
PROXY_PORT=1080

# Step 1: Add profile
echo "Adding VPN profile..."
adb shell am broadcast \
  -a com.cbv.vpn.ADD_PROFILE \
  --es profile_name "$PROFILE_NAME" \
  --es profile_host "$PROXY_HOST" \
  --ei profile_port $PROXY_PORT \
  --es profile_type "socks5"

# Wait 1 second
sleep 1

# Step 2: Start VPN
echo "Starting VPN..."
adb shell am broadcast \
  -a com.cbv.vpn.START_VPN_BY_NAME \
  --es profile_name "$PROFILE_NAME"

echo "VPN started!"
```

### Script 2: Rotate through multiple profiles

```bash
#!/bin/bash

# Danh sách profiles
PROFILES=("Office VPN" "Home VPN" "Public VPN")

for profile in "${PROFILES[@]}"; do
  echo "Testing profile: $profile"
  
  # Start VPN
  adb shell am broadcast \
    -a com.cbv.vpn.START_VPN_BY_NAME \
    --es profile_name "$profile"
  
  # Wait 10 seconds
  sleep 10
  
  # Dừng VPN
  adb shell am broadcast -a com.cbv.vpn.STOP_VPN
  
  # Wait 2 seconds before switching to the next profile
  sleep 2
done

echo "All profiles tested!"
```

### Script 3: Monitor VPN status

```bash
#!/bin/bash

echo "Monitoring VPN status (Ctrl+C to stop)..."

while true; do
  # Request status
  adb shell am broadcast -a com.cbv.vpn.GET_STATUS > /dev/null 2>&1
  
  # Show logs
  adb logcat -d -s VPNConnectionService:I | tail -5
  
  echo "---"
  sleep 5
done
```

### Script 4: Create multiple profiles from a config file

```bash
#!/bin/bash

# Config format: name|host|port|type|username|password
# Example: Office Proxy|10.0.0.1|1080|socks5|user1|pass1

CONFIG_FILE="vpn_profiles.txt"

while IFS='|' read -r name host port type username password; do
  echo "Adding profile: $name"
  
  adb shell am broadcast \
    -a com.cbv.vpn.ADD_PROFILE \
    --es profile_name "$name" \
    --es profile_host "$host" \
    --ei profile_port "$port" \
    --es profile_type "$type" \
    --es profile_username "$username" \
    --es profile_password "$password"
  
  sleep 0.5
done < "$CONFIG_FILE"

echo "All profiles added!"
```

---

## Debugging

### View logs

```bash
# View all VPN-related logs
adb logcat -s VPNIntentReceiver VPNConnectionService VPNModule

# Only show logs from IntentReceiver
adb logcat -s VPNIntentReceiver:D

# Clear logs and show new entries
adb logcat -c && adb logcat -s VPNIntentReceiver VPNConnectionService
```

### Inspect stored profiles

```bash
# View SharedPreferences (requires debuggable app or rooted device)
adb shell run-as com.cbv.vpn cat /data/data/com.cbv.vpn/shared_prefs/vpn_prefs.xml

# Or pull the file to local storage
adb shell run-as com.cbv.vpn cp /data/data/com.cbv.vpn/shared_prefs/vpn_prefs.xml /sdcard/
adb pull /sdcard/vpn_prefs.xml
cat vpn_prefs.xml
```

---

## Troubleshooting

### Intent fails to fire

1. **Verify the package name** is `com.cbv.vpn`.
2. **Make sure the app is installed**: `adb shell pm list packages | grep cbv.vpn`
3. **Check logs**: `adb logcat -s VPNIntentReceiver:D`

### Profile fails to add

- Ensure `profile_name` and `profile_host` parameters are passed.
- Check logs: `adb logcat -s VPNIntentReceiver:D`

### VPN fails to connect

- Confirm VPN permission has been granted (open the app once and approve the dialog).
- Verify the proxy server is reachable and running.
- Check logs: `adb logcat -s VPNConnectionService:D`

---

## Integrations

### Tasker (Android automation)

In Tasker, create a new task:
1. Add Action → System → Send Intent
2. Action: `com.cbv.vpn.START_VPN_BY_NAME`
3. Extra: `profile_name:My VPN`
4. Target: Broadcast Receiver

### Python script

```python
import subprocess

def add_vpn_profile(name, host, port=1080, proxy_type="socks5"):
    cmd = [
        "adb", "shell", "am", "broadcast",
        "-a", "com.cbv.vpn.ADD_PROFILE",
        "--es", "profile_name", name,
        "--es", "profile_host", host,
        "--ei", "profile_port", str(port),
        "--es", "profile_type", proxy_type
    ]
    subprocess.run(cmd)

def start_vpn(profile_name):
    cmd = [
        "adb", "shell", "am", "broadcast",
        "-a", "com.cbv.vpn.START_VPN_BY_NAME",
        "--es", "profile_name", profile_name
    ]
    subprocess.run(cmd)

def stop_vpn():
    cmd = ["adb", "shell", "am", "broadcast", "-a", "com.cbv.vpn.STOP_VPN"]
    subprocess.run(cmd)

# Usage
add_vpn_profile("Test VPN", "192.168.1.100", 1080, "socks5")
start_vpn("Test VPN")
```

---

## Bảo mật

⚠️ **Lưu ý bảo mật**:
- Intent receiver được export (`android:exported="true"`) để có thể nhận intent từ bên ngoài
- Bất kỳ app nào trên thiết bị cũng có thể gửi intent để thêm/kích hoạt VPN
- Không nên lưu password nhạy cảm qua intent nếu thiết bị có nhiều apps không tin cậy
- Cân nhắc thêm signature permission hoặc authentication mechanism cho production

---

## Tham khảo

- [Android Broadcast Intents](https://developer.android.com/guide/components/broadcasts)
- [ADB Shell Commands](https://developer.android.com/studio/command-line/adb)
- [VpnService API](https://developer.android.com/reference/android/net/VpnService)
