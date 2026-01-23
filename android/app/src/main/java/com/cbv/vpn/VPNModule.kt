package com.cbv.vpn

import android.Manifest
import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.VpnService
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONArray
import org.json.JSONObject

class VPNModule(reactContext: ReactApplicationContext) :
        ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    private val TAG = "VPNModule"
    private val VPN_REQUEST_CODE = 1001

    private var pendingVPNPromise: Promise? = null
    private var pendingProfile: JSONObject? = null

    private var isConnected = false
    private var lastDuration: Long = 0L
    private var lastBytesUp: Long = 0L
    private var lastBytesDown: Long = 0L
    private var lastPublicIp: String? = null

    private val vpnStatusReceiver =
            object : BroadcastReceiver() {
                override fun onReceive(context: Context?, intent: Intent?) {
                    if (intent?.action == VPNConnectionService.ACTION_VPN_STATUS) {
                        val status = intent.getStringExtra(VPNConnectionService.EXTRA_STATUS) ?: ""
                        val isConnectedFlag =
                                intent.getBooleanExtra(
                                        VPNConnectionService.EXTRA_IS_CONNECTED,
                                        false
                                )
                        val duration = intent.getLongExtra(VPNConnectionService.EXTRA_DURATION, 0L)
                        val bytesUp = intent.getLongExtra(VPNConnectionService.EXTRA_BYTES_UP, 0L)
                        val bytesDown =
                                intent.getLongExtra(VPNConnectionService.EXTRA_BYTES_DOWN, 0L)
                        val error = intent.getStringExtra(VPNConnectionService.EXTRA_ERROR)
                        val publicIp = intent.getStringExtra(VPNConnectionService.EXTRA_PUBLIC_IP)

                        Log.d(
                                TAG,
                                "📨 Received VPN status broadcast: status=$status, isConnected=$isConnectedFlag"
                        )

                        isConnected = isConnectedFlag
                        lastDuration = duration
                        lastBytesUp = bytesUp
                        lastBytesDown = bytesDown
                        lastPublicIp = publicIp

                        sendStatusEvent(
                                state = status,
                                isConnectedFlag = isConnectedFlag,
                                duration = duration,
                                bytesUp = bytesUp,
                                bytesDown = bytesDown,
                                publicIp = publicIp
                        )

                        if (!error.isNullOrEmpty()) {
                            Log.e(TAG, "❌ VPN error: $error")
                            sendEvent(
                                    "error",
                                    Arguments.createMap().apply { putString("message", error) }
                            )
                        }
                    }
                }
            }

    private val profilesUpdatedReceiver =
            object : BroadcastReceiver() {
                override fun onReceive(context: Context?, intent: Intent?) {
                    when (intent?.action) {
                        VPNIntentReceiver.ACTION_PROFILES_UPDATED -> {
                            Log.d(TAG, "📨 Received profiles updated broadcast from native")
                            val params =
                                    Arguments.createMap().apply {
                                        putString("id", intent.getStringExtra("profile_id"))
                                        putString("name", intent.getStringExtra("profile_name"))
                                        putString("host", intent.getStringExtra("profile_host"))
                                        putInt("port", intent.getIntExtra("profile_port", 0))
                                        putString(
                                                "type",
                                                intent.getStringExtra("profile_type") ?: "socks5"
                                        )
                                        putBoolean(
                                                "hasAuth",
                                                intent.getBooleanExtra("has_auth", false)
                                        )
                                        putBoolean(
                                                "isUpdate",
                                                intent.getBooleanExtra("is_update", false)
                                        )
                                    }
                            sendEvent("profilesUpdated", params)
                        }
                        "com.cbv.vpn.REQUEST_VPN_PERMISSION" -> {
                            Log.d(TAG, "📨 Received VPN permission request from native")
                            val params =
                                    Arguments.createMap().apply {
                                        putString("profileId", intent.getStringExtra("profile_id"))
                                        putString(
                                                "profileName",
                                                intent.getStringExtra("profile_name")
                                        )
                                    }
                            sendEvent("vpnPermissionRequired", params)
                        }
                        "com.cbv.vpn.ACTIVE_PROFILE_CHANGED" -> {
                            Log.d(TAG, "📨 Received active profile changed from native")
                            val params =
                                    Arguments.createMap().apply {
                                        putString("profileId", intent.getStringExtra("profile_id"))
                                        putString(
                                                "profileName",
                                                intent.getStringExtra("profile_name")
                                        )
                                    }
                            sendEvent("activeProfileChanged", params)
                        }
                        "com.cbv.vpn.REQUEST_NOTIF_PERMISSION" -> {
                            Log.d(TAG, "📨 Notification permission required on Android 13+")
                            val params = Arguments.createMap()
                            sendEvent("notificationPermissionRequired", params)
                        }
                    }
                }
            }

    init {
        reactContext.addActivityEventListener(this)
        val filter = IntentFilter(VPNConnectionService.ACTION_VPN_STATUS)
        LocalBroadcastManager.getInstance(reactContext).registerReceiver(vpnStatusReceiver, filter)

        val profileFilter =
                IntentFilter().apply {
                    addAction(VPNIntentReceiver.ACTION_PROFILES_UPDATED)
                    addAction("com.cbv.vpn.REQUEST_VPN_PERMISSION")
                    addAction("com.cbv.vpn.REQUEST_NOTIF_PERMISSION")
                    addAction("com.cbv.vpn.ACTIVE_PROFILE_CHANGED")
                }
        LocalBroadcastManager.getInstance(reactContext)
                .registerReceiver(profilesUpdatedReceiver, profileFilter)
        Log.d(TAG, "📡 VPN status receiver registered")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            try {
                val prefs =
                        reactApplicationContext.getSharedPreferences("vpn_prefs", Context.MODE_PRIVATE)
                val pending = prefs.getBoolean("notification_permission_pending", false)
                if (pending) {
                    val granted =
                            ContextCompat.checkSelfPermission(
                                    reactApplicationContext,
                                    Manifest.permission.POST_NOTIFICATIONS
                            ) == PackageManager.PERMISSION_GRANTED
                    if (!granted) {
                        sendEvent("notificationPermissionRequired", Arguments.createMap())
                    }
                    prefs.edit().putBoolean("notification_permission_pending", false).apply()
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to check pending notification permission: ${e.message}")
            }
        }
        requestStatusRefresh()
    }

    override fun getName(): String {
        return "VPNModule"
    }

    override fun onActivityResult(
            activity: Activity,
            requestCode: Int,
            resultCode: Int,
            data: Intent?
    ) {
        if (requestCode == VPN_REQUEST_CODE) {
            Log.d(TAG, "========================================")
            Log.d(TAG, "📱 onActivityResult() - VPN permission dialog result")
            Log.d(TAG, "📋 Result code: $resultCode")
            Log.d(TAG, "========================================")

            if (resultCode == Activity.RESULT_OK) {
                Log.d(TAG, "✅ VPN permission GRANTED by user")
                
                // Check if this is just a permission check (no profile)
                if (pendingProfile == null) {
                    Log.d(TAG, "✅ Permission-only check completed successfully")
                    pendingVPNPromise?.resolve(true)
                } else {
                    Log.d(TAG, "🚀 Starting VPN service...")
                    pendingProfile?.let { profile ->
                        try {
                            startVPNService(profile)
                            lastDuration = 0L
                            lastBytesUp = 0L
                            lastBytesDown = 0L
                            lastPublicIp = null
                            sendStatusEvent(
                                    state = "connecting",
                                    isConnectedFlag = false,
                                    duration = 0L,
                                    bytesUp = 0L,
                                    bytesDown = 0L,
                                    publicIp = null
                            )
                            pendingVPNPromise?.resolve(null)
                        } catch (e: Exception) {
                            Log.e(TAG, "========================================")
                            Log.e(TAG, "❌ Error starting VPN after permission")
                            Log.e(TAG, "❌ Exception: ${e.message}")
                            Log.e(TAG, "========================================")
                            e.printStackTrace()
                            pendingVPNPromise?.reject("VPN_START_ERROR", e.message, e)
                        }
                    }
                }
            } else {
                Log.w(TAG, "========================================")
                Log.w(TAG, "❌ VPN permission DENIED by user")
                Log.w(TAG, "========================================")
                pendingVPNPromise?.reject("VPN_PERMISSION_DENIED", "User denied VPN permission")
            }
            pendingVPNPromise = null
            pendingProfile = null
        }
    }

    override fun onNewIntent(intent: Intent) {}

    @ReactMethod
    fun getProfiles(promise: Promise) {
        try {
            val profiles = getProfilesArray()
            val result = Arguments.createArray()
            for (i in 0 until profiles.length()) {
                val profile = profiles.getJSONObject(i)
                val map = Arguments.createMap()
                map.putString("id", profile.getString("id"))
                map.putString("name", profile.getString("name"))
                map.putString("host", profile.getString("host"))
                map.putInt("port", profile.getInt("port"))
                map.putString("type", profile.optString("type", "socks5"))
                map.putString("username", profile.optString("username", ""))
                map.putString("password", profile.optString("password", ""))
                result.pushMap(map)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("GET_PROFILES_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun saveProfile(
            name: String,
            host: String,
            port: Int,
            type: String,
            username: String,
            password: String,
            promise: Promise
    ) {
        try {
            val profiles = getProfilesArray()
            val newProfile = JSONObject()
            newProfile.put("id", System.currentTimeMillis().toString())
            newProfile.put("name", name)
            newProfile.put("host", host)
            newProfile.put("port", port)
            newProfile.put("type", type)
            newProfile.put("username", username)
            newProfile.put("password", password)

            profiles.put(newProfile)

            val prefs =
                    reactApplicationContext.getSharedPreferences("vpn_prefs", Context.MODE_PRIVATE)
            prefs.edit().putString("profiles", profiles.toString()).apply()

            promise.resolve(newProfile.getString("id"))
        } catch (e: Exception) {
            promise.reject("SAVE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun deleteProfile(profileId: String, promise: Promise) {
        try {
            val profiles = getProfilesArray()
            val newProfiles = JSONArray()

            for (i in 0 until profiles.length()) {
                val profile = profiles.getJSONObject(i)
                if (profile.getString("id") != profileId) {
                    newProfiles.put(profile)
                }
            }

            val prefs =
                    reactApplicationContext.getSharedPreferences("vpn_prefs", Context.MODE_PRIVATE)
            prefs.edit().putString("profiles", newProfiles.toString()).apply()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("DELETE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun startVPN(profileId: String, promise: Promise) {
        try {
            Log.d(TAG, "========================================")
            Log.d(TAG, "🚀 startVPN() called from React Native")
            Log.d(TAG, "📋 Profile ID: $profileId")
            Log.d(TAG, "========================================")

            // Get profile from native storage
            val profiles = getProfilesArray()
            Log.d(TAG, "📂 Found ${profiles.length()} profiles in native storage")

            var profile: JSONObject? = null
            for (i in 0 until profiles.length()) {
                val p = profiles.getJSONObject(i)
                if (p.getString("id") == profileId) {
                    profile = p
                    Log.d(TAG, "✅ Found matching profile: ${p.optString("name", "Unknown")}")
                    break
                }
            }

            if (profile == null) {
                Log.e(TAG, "❌ Profile not found in native storage: $profileId")
                Log.e(TAG, "❌ This means profiles are not synced from React Native to native")
                promise.reject(
                        "PROFILE_NOT_FOUND",
                        "Profile not found. Please use startVPNWithProfile instead."
                )
                return
            }

            Log.d(TAG, "📋 Profile details:")
            Log.d(TAG, "  - Name: ${profile.optString("name", "Unknown")}")
            Log.d(TAG, "  - Host: ${profile.getString("host")}")
            Log.d(TAG, "  - Port: ${profile.getInt("port")}")
            Log.d(TAG, "  - Type: ${profile.optString("type", "socks5")}")

            Log.d(TAG, "🔐 Checking VPN permission...")
            val prepareIntent = VpnService.prepare(reactApplicationContext)
            if (prepareIntent != null) {
                Log.w(TAG, "========================================")
                Log.w(TAG, "⚠️ VPN permission not granted")
                Log.w(TAG, "⚠️ Requesting permission from user...")
                Log.w(TAG, "========================================")

                pendingVPNPromise = promise
                pendingProfile = profile

                val activity = reactApplicationContext.currentActivity
                if (activity != null) {
                    Log.d(TAG, "📱 Starting VPN permission activity...")
                    activity.startActivityForResult(prepareIntent, VPN_REQUEST_CODE)
                    Log.d(TAG, "⏳ Waiting for user to approve VPN permission...")
                } else {
                    Log.e(TAG, "❌ No activity available to request VPN permission")
                    promise.reject("NO_ACTIVITY", "No activity available")
                    pendingVPNPromise = null
                    pendingProfile = null
                }
                return
            } else {
                Log.d(TAG, "✅ VPN permission already granted")
            }

            Log.d(
                    TAG,
                    "🚀 Starting VPN service with profile: ${profile.optString("name", "Unknown")}"
            )

            stopExistingVPNForRestart()

            // Save this profile as the last connected profile for auto-connect
            setLastConnectedProfileId(profileId)

            // Clear manually disconnected flag when starting VPN
            val prefs =
                    reactApplicationContext.getSharedPreferences("vpn_prefs", Context.MODE_PRIVATE)
            prefs.edit().putBoolean("manually_disconnected", false).apply()
            // Mark automation session as false when started from UI/React
            prefs.edit().putBoolean("automation_session_active", false).apply()
            Log.d(TAG, "💾 Cleared manually disconnected flag")

            startVPNService(profile)
            lastDuration = 0L
            lastBytesUp = 0L
            lastBytesDown = 0L
            lastPublicIp = null
            sendStatusEvent(
                    state = "connecting",
                    isConnectedFlag = false,
                    duration = 0L,
                    bytesUp = 0L,
                    bytesDown = 0L,
                    publicIp = null
            )
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "Error starting VPN", e)
            promise.reject("VPN_START_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun startVPNWithProfile(
            name: String,
            host: String,
            port: Int,
            type: String,
            username: String,
            password: String,
            dns1: String?,
            dns2: String?,
            promise: Promise
    ) {
        try {
            Log.d(TAG, "========================================")
            Log.d(TAG, "🚀 startVPNWithProfile() called from React Native")
            Log.d(TAG, "========================================")

            val profile = JSONObject()
            profile.put("id", System.currentTimeMillis().toString())
            profile.put("name", name)
            profile.put("host", host)
            profile.put("port", port)
            profile.put("type", type)
            profile.put("username", username)
            profile.put("password", password)
            profile.put("dns1", dns1 ?: "1.1.1.1")
            profile.put("dns2", dns2 ?: "8.8.8.8")

            Log.d(TAG, "📋 Profile details:")
            Log.d(TAG, "  - Name: $name")
            Log.d(TAG, "  - Host: $host")
            Log.d(TAG, "  - Port: $port")
            Log.d(TAG, "  - Type: $type")

            Log.d(TAG, "🔐 Checking VPN permission...")
            val prepareIntent = VpnService.prepare(reactApplicationContext)
            if (prepareIntent != null) {
                Log.w(TAG, "========================================")
                Log.w(TAG, "⚠️ VPN permission not granted")
                Log.w(TAG, "⚠️ Requesting permission from user...")
                Log.w(TAG, "========================================")

                pendingVPNPromise = promise
                pendingProfile = profile

                val activity = reactApplicationContext.currentActivity
                if (activity != null) {
                    Log.d(TAG, "📱 Starting VPN permission activity...")
                    activity.startActivityForResult(prepareIntent, VPN_REQUEST_CODE)
                    Log.d(TAG, "⏳ Waiting for user to approve VPN permission...")
                } else {
                    Log.e(TAG, "❌ No activity available to request VPN permission")
                    promise.reject("NO_ACTIVITY", "No activity available")
                    pendingVPNPromise = null
                    pendingProfile = null
                }
                return
            } else {
                Log.d(TAG, "✅ VPN permission already granted")
            }

            Log.d(TAG, "🚀 Starting VPN service with profile: $name")

            stopExistingVPNForRestart()

            // Clear manually disconnected flag when starting VPN
            val prefs =
                    reactApplicationContext.getSharedPreferences("vpn_prefs", Context.MODE_PRIVATE)
            prefs.edit().putBoolean("manually_disconnected", false).apply()
            prefs.edit().putBoolean("automation_session_active", false).apply()
            Log.d(TAG, "💾 Cleared manually disconnected flag")

            startVPNService(profile)
            lastDuration = 0L
            lastBytesUp = 0L
            lastBytesDown = 0L
            sendStatusEvent(
                    state = "connecting",
                    isConnectedFlag = false,
                    duration = 0L,
                    bytesUp = 0L,
                    bytesDown = 0L,
                    publicIp = null
            )
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "Error starting VPN with profile", e)
            promise.reject("VPN_START_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopVPN(force: Boolean, promise: Promise) {
        try {
            Log.d(TAG, "🛑 Stopping VPN...")

            val prefs =
                    reactApplicationContext.getSharedPreferences("vpn_prefs", Context.MODE_PRIVATE)
            // Only mark manual disconnect when explicitly forced (user/UI or STOP intent)
            if (force) {
                prefs.edit().putBoolean("manually_disconnected", true).apply()
                prefs.edit().putBoolean("automation_session_active", false).apply()
                Log.d(TAG, "💾 Marked VPN as manually disconnected (force=$force)")
            } else {
                Log.d(
                        TAG,
                        "🛡️ Stop request ignored (force=false). Automation session protected."
                )
                promise.resolve(null)
                return
            }

            val intent = Intent(reactApplicationContext, VPNConnectionService::class.java)
            intent.putExtra("action", "stop")
            intent.putExtra("force", force)
            reactApplicationContext.startService(intent)

            isConnected = false
            lastDuration = 0L
            lastBytesUp = 0L
            lastBytesDown = 0L
            lastPublicIp = null

            sendStatusEvent(
                    state = "disconnected",
                    isConnectedFlag = false,
                    duration = 0L,
                    bytesUp = 0L,
                    bytesDown = 0L,
                    publicIp = null
            )
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("VPN_STOP_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getStatus(promise: Promise) {
        try {
            val result = Arguments.createMap()
            result.putBoolean("isConnected", isConnected)
            result.putDouble("durationMillis", lastDuration.toDouble())
            result.putDouble("bytesUp", lastBytesUp.toDouble())
            result.putDouble("bytesDown", lastBytesDown.toDouble())
            lastPublicIp?.let { result.putString("publicIp", it) }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("GET_STATUS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun refreshStatus() {
        Log.d(TAG, "🔄 refreshStatus() called")
        requestStatusRefresh()
    }

    private fun requestStatusRefresh() {
        try {
            val intent = Intent(reactApplicationContext, VPNConnectionService::class.java)
            intent.putExtra("action", VPNConnectionService.COMMAND_STATUS)
            reactApplicationContext.startService(intent)
            Log.d(TAG, "📡 Requested VPN status refresh from service")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to request VPN status refresh: ${e.message}")
        }
    }

    @ReactMethod fun removeListeners(count: Int) {}

    private fun stopExistingVPNForRestart() {
        try {
            Log.d(TAG, "🛑 Stopping existing VPN before reconnect")
            val stopIntent = Intent(reactApplicationContext, VPNConnectionService::class.java)
            stopIntent.putExtra("action", VPNConnectionService.COMMAND_STOP)
            stopIntent.putExtra("force", true)
            reactApplicationContext.startService(stopIntent)
            Thread.sleep(500)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to stop VPN before reconnect: ${e.message}")
        }
    }

    private fun startVPNService(profile: JSONObject) {
        Log.d(TAG, "========================================")
        Log.d(TAG, "🔧 startVPNService() called")
        Log.d(TAG, "========================================")

        val intent = Intent(reactApplicationContext, VPNConnectionService::class.java)
        val proxyHost = profile.getString("host")

        Log.d(TAG, "🌐 Resolving proxy hostname: $proxyHost")
        var proxyIP = proxyHost
        try {
            val addr = java.net.InetAddress.getByName(proxyHost)
            proxyIP = addr.hostAddress ?: proxyHost
            Log.d(TAG, "✅ Resolved to IP: $proxyIP")
        } catch (e: Exception) {
            Log.w(TAG, "⚠️ Could not resolve hostname, using as-is: ${e.message}")
        }

        intent.putExtra("server", proxyHost)
        intent.putExtra("serverIP", proxyIP)
        intent.putExtra("port", profile.getInt("port"))
        intent.putExtra("type", profile.optString("type", "socks5"))
        intent.putExtra("username", profile.optString("username", "").trim())
        intent.putExtra("password", profile.optString("password", "").trim())
        intent.putExtra("dns1", profile.optString("dns1", "1.1.1.1"))
        intent.putExtra("dns2", profile.optString("dns2", "8.8.8.8"))

        Log.d(TAG, "📦 Intent extras:")
        Log.d(TAG, "  - server: $proxyHost")
        Log.d(TAG, "  - serverIP: $proxyIP")
        Log.d(TAG, "  - port: ${profile.getInt("port")}")
        Log.d(TAG, "  - type: ${profile.optString("type", "socks5")}")

        try {
            Log.d(TAG, "🚀 Starting VPN service...")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(intent)
            } else {
                reactApplicationContext.startService(intent)
            }
            Log.d(TAG, "========================================")
            Log.d(TAG, "✅ VPN service started successfully")
            Log.d(TAG, "========================================")
        } catch (e: Exception) {
            Log.e(TAG, "========================================")
            Log.e(TAG, "❌ Failed to start VPN service")
            Log.e(TAG, "❌ Exception: ${e.message}")
            Log.e(TAG, "========================================")
            e.printStackTrace()
            throw e
        }
    }

    private fun sendStatusEvent(
            state: String,
            isConnectedFlag: Boolean,
            duration: Long,
            bytesUp: Long,
            bytesDown: Long,
            publicIp: String?
    ) {
        Log.d(TAG, "📤 sendStatusEvent()")
        Log.d(TAG, "  - state: $state")
        Log.d(TAG, "  - isConnected: $isConnectedFlag")
        Log.d(TAG, "  - duration: ${duration}ms")

        val params = Arguments.createMap()
        params.putString("state", state)
        params.putBoolean("isConnected", isConnectedFlag)
        params.putDouble("durationMillis", duration.toDouble())
        params.putDouble("bytesUp", bytesUp.toDouble())
        params.putDouble("bytesDown", bytesDown.toDouble())
        if (!publicIp.isNullOrEmpty()) {
            params.putString("publicIp", publicIp)
        }

        Log.d(TAG, "📡 Sending 'statusChanged' event to React Native...")
        sendEvent("statusChanged", params)
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        try {
            reactApplicationContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit(eventName, params)
            Log.d(TAG, "✅ Event '$eventName' emitted successfully")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error emitting event '$eventName': ${e.message}")
        }
    }

    @ReactMethod
    fun getActiveProfileId(promise: Promise) {
        try {
            val prefs =
                    reactApplicationContext.getSharedPreferences("vpn_prefs", Context.MODE_PRIVATE)
            val activeProfileId = prefs.getString("selected_profile_id", null)
            Log.d(TAG, "📂 Getting active profile ID from SharedPreferences: $activeProfileId")
            promise.resolve(activeProfileId)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error getting active profile ID: ${e.message}", e)
            promise.reject("GET_ACTIVE_PROFILE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun setAutoConnectEnabled(enabled: Boolean, promise: Promise) {
        try {
            val prefs =
                    reactApplicationContext.getSharedPreferences("vpn_prefs", Context.MODE_PRIVATE)
            prefs.edit().putBoolean("auto_connect_enabled", enabled).apply()
            Log.d(TAG, "💾 Auto-connect preference saved: $enabled")
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error saving auto-connect preference: ${e.message}", e)
            promise.reject("SET_AUTO_CONNECT_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getAutoConnectEnabled(promise: Promise) {
        try {
            val prefs =
                    reactApplicationContext.getSharedPreferences("vpn_prefs", Context.MODE_PRIVATE)
            val enabled = prefs.getBoolean("auto_connect_enabled", false)
            Log.d(TAG, "📂 Getting auto-connect preference: $enabled")
            promise.resolve(enabled)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error getting auto-connect preference: ${e.message}", e)
            promise.reject("GET_AUTO_CONNECT_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun openVPNSettings(promise: Promise) {
        try {
            val packageName = reactApplicationContext.packageName
            Log.d(TAG, "📱 Opening VPN settings for package: $packageName")
            
            // On Android 7+ try different approaches to open VPN profile settings
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                
                // Option 1: Try Samsung-specific VPN settings (works on Samsung devices)
                try {
                    val samsungIntent = android.content.Intent()
                    samsungIntent.setClassName(
                        "com.android.settings",
                        "com.android.settings.Settings\$VpnSettingsActivity"
                    )
                    samsungIntent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                    reactApplicationContext.startActivity(samsungIntent)
                    Log.d(TAG, "✅ Opened VPN settings via VpnSettingsActivity")
                    promise.resolve(true)
                    return
                } catch (e: Exception) {
                    Log.w(TAG, "⚠️ VpnSettingsActivity not available: ${e.message}")
                }
                
                // Option 2: Try AOSP VPN settings component
                try {
                    val aospIntent = android.content.Intent()
                    aospIntent.setClassName(
                        "com.android.settings",
                        "com.android.settings.vpn2.VpnSettings"
                    )
                    aospIntent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                    reactApplicationContext.startActivity(aospIntent)
                    Log.d(TAG, "✅ Opened VPN settings via VpnSettings")
                    promise.resolve(true)
                    return
                } catch (e: Exception) {
                    Log.w(TAG, "⚠️ VpnSettings not available: ${e.message}")
                }
                
                // Option 3: Try to open the VPN app profile settings directly through content URI
                try {
                    val vpnProfileIntent = android.content.Intent(android.provider.Settings.ACTION_VPN_SETTINGS)
                    vpnProfileIntent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                    // Add data to try to select our app
                    vpnProfileIntent.putExtra(":settings:fragment_args_key", packageName)
                    vpnProfileIntent.putExtra("package", packageName)
                    reactApplicationContext.startActivity(vpnProfileIntent)
                    Log.d(TAG, "✅ Opened VPN settings with package extra")
                    promise.resolve(true)
                    return
                } catch (e: Exception) {
                    Log.w(TAG, "⚠️ Could not open with package extra: ${e.message}")
                }
            }
            
            // Final fallback: Standard ACTION_VPN_SETTINGS
            val vpnIntent = android.content.Intent(android.provider.Settings.ACTION_VPN_SETTINGS)
            vpnIntent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(vpnIntent)
            Log.d(TAG, "✅ Opened general VPN settings")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error opening VPN settings: ${e.message}", e)
            // Fallback to general wireless settings
            try {
                val fallbackIntent = android.content.Intent(android.provider.Settings.ACTION_WIRELESS_SETTINGS)
                fallbackIntent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(fallbackIntent)
                promise.resolve(true)
            } catch (e2: Exception) {
                Log.e(TAG, "❌ Fallback also failed: ${e2.message}", e2)
                promise.reject("OPEN_VPN_SETTINGS_ERROR", e.message, e)
            }
        }
    }

    private fun setLastConnectedProfileId(profileId: String) {
        try {
            val prefs =
                    reactApplicationContext.getSharedPreferences("vpn_prefs", Context.MODE_PRIVATE)
            prefs.edit().putString("last_connected_profile_id", profileId).apply()
            Log.d(TAG, "💾 Last connected profile ID saved: $profileId")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error saving last connected profile ID: ${e.message}", e)
        }
    }

    fun getLastConnectedProfileId(): String? {
        return try {
            val prefs =
                    reactApplicationContext.getSharedPreferences("vpn_prefs", Context.MODE_PRIVATE)
            val profileId = prefs.getString("last_connected_profile_id", null)
            Log.d(TAG, "📂 Getting last connected profile ID: $profileId")
            profileId
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error getting last connected profile ID: ${e.message}", e)
            null
        }
    }

    fun getAutoConnectEnabledInternal(): Boolean {
        return try {
            val prefs =
                    reactApplicationContext.getSharedPreferences("vpn_prefs", Context.MODE_PRIVATE)
            prefs.getBoolean("auto_connect_enabled", false)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error getting auto-connect preference: ${e.message}", e)
            false
        }
    }

    private fun getProfilesArray(): JSONArray {
        val prefs = reactApplicationContext.getSharedPreferences("vpn_prefs", Context.MODE_PRIVATE)
        val profilesStr = prefs.getString("profiles", "[]")
        return JSONArray(profilesStr ?: "[]")
    }

    @ReactMethod
fun checkProxyHealth(
    type: String,
    host: String,
    port: Int,
    username: String,
    password: String,
    promise: Promise
) {
    // Run in background thread to avoid blocking UI
    Thread {
        try {
            Log.d("HealthCheck", "🏥 Starting health check for $type proxy $host:$port")
            val start = System.nanoTime()
            val socket = java.net.Socket()
            
            // Set timeouts for health check (5 seconds)
            socket.soTimeout = 5_000
            
            val isHttp = type.equals("http", ignoreCase = true)
            
            // Choose handler based on type
            // For HTTP: connectHttpQuick sends GET request directly through proxy
            // For SOCKS5: connectSocks5Quick establishes tunnel, then we send GET request
            val connected = if (isHttp) {
                connectHttpQuick(socket, host, port, 
                    if (username.isBlank()) null else username.trim(), 
                    if (password.isBlank()) null else password.trim())
            } else {
                connectSocks5Quick(socket, host, port, 
                    if (username.isBlank()) null else username.trim(), 
                    if (password.isBlank()) null else password.trim())
            }
            
            if (!connected) {
                try { socket.close() } catch (_: Exception) {}
                val latencyMs = ((System.nanoTime() - start) / 1_000_000L).toInt()
                Log.e("HealthCheck", "❌ Proxy handshake failed")
                val result = Arguments.createMap()
                result.putBoolean("ok", false)
                result.putInt("latencyMs", latencyMs)
                result.putString("error", "Proxy handshake failed")
                promise.resolve(result)
                return@Thread
            }
            
            Log.d("HealthCheck", "✅ Connected to proxy, reading response...")

            val input = socket.getInputStream()
            val output = socket.getOutputStream()
            
            // For SOCKS5, we need to send HTTP request through the tunnel
            // For HTTP proxy, the request was already sent in connectHttpQuick
            if (!isHttp) {
                val httpRequest = "GET /json HTTP/1.1\r\n" +
                        "Host: ip-api.com\r\n" +
                        "Connection: close\r\n" +
                        "User-Agent: ProxyHealthCheck/1.0\r\n" +
                        "\r\n"
                
                output.write(httpRequest.toByteArray())
                output.flush()
                Log.d("HealthCheck", "📤 Sent HTTP request through SOCKS5 tunnel")
            }
            
            // Read response with timeout - give more time
            socket.soTimeout = 5_000
            val response = StringBuilder()
            val buffer = ByteArray(2048)
            var bytesRead: Int
            var totalRead = 0
            
            try {
                // Keep reading until we get enough data or timeout
                while (totalRead < 500) {
                    bytesRead = input.read(buffer)
                    if (bytesRead == -1) break
                    response.append(String(buffer, 0, bytesRead))
                    totalRead += bytesRead
                    Log.d("HealthCheck", "📥 Read $bytesRead bytes (total: $totalRead)")
                    // Check if we have complete response (headers + body)
                    if (response.contains("\r\n\r\n") && response.length > 50) break
                }
            } catch (e: java.net.SocketTimeoutException) {
                Log.w("HealthCheck", "⏱️ Socket timeout after reading $totalRead bytes")
                // Timeout is OK if we already have data
            }
            
            socket.close()
            
            val latencyMs = ((System.nanoTime() - start) / 1_000_000L).toInt()
            val responseStr = response.toString()
            
            Log.d("HealthCheck", "📋 Full response ($latencyMs ms):\n${responseStr.take(300)}")
            
            // Parse response - check for HTTP 200 and extract IP
            val result = Arguments.createMap()
            if (responseStr.contains("200 OK") || responseStr.contains("HTTP/1.1 200") || responseStr.contains("HTTP/1.0 200")) {
                // Try to extract IP from response body
                val bodyStart = responseStr.indexOf("\r\n\r\n")
                var ip = ""
                if (bodyStart != -1) {
                    val body = responseStr.substring(bodyStart + 4).trim()
                    // Try to find IP in body using regex
                    val ipRegex = Regex("\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}")
                    ip = ipRegex.find(body)?.value ?: ""
                }
                
                Log.d("HealthCheck", "🌐 Extracted IP: '$ip'")
                
                // Proxy is healthy if we got HTTP 200 - IP extraction is optional
                result.putBoolean("ok", true)
                result.putInt("latencyMs", latencyMs)
                if (ip.isNotEmpty()) {
                    result.putString("ip", ip)
                }
                Log.d("HealthCheck", "✅ Health check PASSED" + if (ip.isNotEmpty()) ": $ip" else " (no IP extracted)")
            } else {
                result.putBoolean("ok", false)
                result.putInt("latencyMs", latencyMs)
                result.putString("error", "HTTP request failed: ${responseStr.take(100)}")
                Log.e("HealthCheck", "❌ HTTP request failed, response: ${responseStr.take(200)}")
            }
            
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e("HealthCheck", "❌ Exception: ${e.message}", e)
            val result = Arguments.createMap()
            result.putBoolean("ok", false)
            result.putInt("latencyMs", 0)
            result.putString("error", e.message ?: "Unknown error")
            promise.resolve(result)
        }
    }.start()
}

// Quick SOCKS5 connect with 3s timeout for health checks
private fun connectSocks5Quick(socket: java.net.Socket, host: String, port: Int, username: String?, password: String?): Boolean {
    try {
        socket.connect(java.net.InetSocketAddress(host, port), 3_000)
        if (!socket.isConnected) return false
        
        val input = socket.getInputStream()
        val output = socket.getOutputStream()
        
        // Auth negotiation
        if (!username.isNullOrEmpty() && !password.isNullOrEmpty()) {
            output.write(byteArrayOf(0x05, 0x02, 0x00, 0x02))
        } else {
            output.write(byteArrayOf(0x05, 0x01, 0x00))
        }
        output.flush()
        
        val authResponse = ByteArray(2)
        if (input.read(authResponse) != 2 || authResponse[0] != 0x05.toByte()) return false
        
        // Handle auth if needed
        when (authResponse[1].toInt() and 0xFF) {
            0x00 -> { /* No auth */ }
            0x02 -> {
                if (username.isNullOrEmpty() || password.isNullOrEmpty()) return false
                val authRequest = mutableListOf<Byte>(0x01, username.length.toByte())
                authRequest.addAll(username.toByteArray().toList())
                authRequest.add(password.length.toByte())
                authRequest.addAll(password.toByteArray().toList())
                output.write(authRequest.toByteArray())
                output.flush()
                val authResult = ByteArray(2)
                if (input.read(authResult) != 2 || authResult[1] != 0x00.toByte()) return false
            }
            else -> return false
        }
        
        // Connect to ip-api.com
        val targetHost = "ip-api.com"
        val targetPort = 80
        val connectRequest = mutableListOf<Byte>(0x05, 0x01, 0x00, 0x03, targetHost.length.toByte())
        connectRequest.addAll(targetHost.toByteArray().toList())
        connectRequest.add((targetPort shr 8).toByte())
        connectRequest.add((targetPort and 0xFF).toByte())
        output.write(connectRequest.toByteArray())
        output.flush()
        
        // Read response
        val connectResponse = ByteArray(4)
        if (input.read(connectResponse) != 4) return false
        if (connectResponse[0] != 0x05.toByte() || connectResponse[1] != 0x00.toByte()) return false
        
        // Skip bind address
        val addrType = connectResponse[3].toInt() and 0xFF
        when (addrType) {
            0x01 -> input.skip(4) // IPv4
            0x03 -> input.skip((input.read() + 0).toLong()) // Domain
            0x04 -> input.skip(16) // IPv6
        }
        input.skip(2) // Port
        
        return true
    } catch (e: Exception) {
        return false
    }
}

// Quick HTTP proxy check with 3s timeout for health checks
// For HTTP proxies, we send the full URL in the GET request (not CONNECT tunnel)
// This matches: curl http://ip-api.com/json --proxy http://host:port
private fun connectHttpQuick(socket: java.net.Socket, host: String, port: Int, username: String?, password: String?): Boolean {
    try {
        socket.connect(java.net.InetSocketAddress(host, port), 3_000)
        if (!socket.isConnected) return false
        
        val output = socket.getOutputStream()
        
        // For HTTP proxy, send GET request with FULL URL (absolute URI)
        // The proxy will forward the request to the target server
        val request = StringBuilder()
        request.append("GET http://ip-api.com/json HTTP/1.1\r\n")
        request.append("Host: ip-api.com\r\n")
        request.append("User-Agent: ProxyHealthCheck/1.0\r\n")
        request.append("Connection: close\r\n")
        
        if (!username.isNullOrEmpty() && !password.isNullOrEmpty()) {
            val credentials = "$username:$password"
            val encoded = android.util.Base64.encodeToString(credentials.toByteArray(), android.util.Base64.NO_WRAP)
            request.append("Proxy-Authorization: Basic $encoded\r\n")
        }
        request.append("\r\n")
        
        output.write(request.toString().toByteArray())
        output.flush()
        
        // Don't read response here - that's done in checkProxyHealth
        // Just return true since connection + request succeeded
        return true
    } catch (e: Exception) {
        return false
    }
}

    @ReactMethod
    fun setPowerProfile(profile: String, promise: Promise) {
        try {
            val validProfiles = listOf("performance", "balanced", "battery_saver")
            if (profile !in validProfiles) {
                promise.reject("INVALID_PROFILE", "Invalid power profile: $profile")
                return
            }
            
            val prefs = reactApplicationContext.getSharedPreferences("vpn_prefs", Context.MODE_PRIVATE)
            prefs.edit().putString("power_profile", profile).apply()
            Log.d(TAG, "⚡ Power profile saved: $profile")
            
            // Notify the running VPN service to update its config
            try {
                val intent = Intent(reactApplicationContext, VPNConnectionService::class.java)
                intent.putExtra("action", "update_power_profile")
                intent.putExtra("power_profile", profile)
                reactApplicationContext.startService(intent)
            } catch (e: Exception) {
                Log.w(TAG, "⚠️ Could not notify VPN service about profile change: ${e.message}")
            }
            
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error saving power profile: ${e.message}", e)
            promise.reject("SET_POWER_PROFILE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getPowerProfile(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("vpn_prefs", Context.MODE_PRIVATE)
            val profile = prefs.getString("power_profile", "balanced") ?: "balanced"
            Log.d(TAG, "📂 Getting power profile: $profile")
            promise.resolve(profile)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error getting power profile: ${e.message}", e)
            promise.reject("GET_POWER_PROFILE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun prepareVPN(promise: Promise) {
        try {
            Log.d(TAG, "========================================")
            Log.d(TAG, "🔐 prepareVPN() - Checking VPN permission")
            Log.d(TAG, "========================================")

            val prepareIntent = VpnService.prepare(reactApplicationContext)
            if (prepareIntent != null) {
                Log.d(TAG, "⚠️ VPN permission not granted, requesting...")
                
                pendingVPNPromise = promise
                pendingProfile = null // No profile, just permission check

                val activity = reactApplicationContext.currentActivity
                if (activity != null) {
                    Log.d(TAG, "📱 Starting VPN permission activity...")
                    activity.startActivityForResult(prepareIntent, VPN_REQUEST_CODE)
                } else {
                    Log.e(TAG, "❌ No activity available to request VPN permission")
                    promise.reject("NO_ACTIVITY", "No activity available")
                    pendingVPNPromise = null
                }
            } else {
                Log.d(TAG, "✅ VPN permission already granted")
                promise.resolve(true)
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error preparing VPN: ${e.message}", e)
            promise.reject("VPN_PREPARE_ERROR", e.message, e)
        }
    }
}
