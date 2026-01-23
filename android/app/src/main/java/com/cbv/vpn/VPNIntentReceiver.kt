package com.cbv.vpn

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.VpnService
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import org.json.JSONArray
import org.json.JSONObject

class VPNIntentReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "VPNIntentReceiver"
        private const val PREFS_NAME = "vpn_prefs"
        private const val KEY_PENDING_PROFILE_JSON = "pending_profile_json"

        // Intent actions
        const val ACTION_ADD_PROFILE = "com.cbv.vpn.ADD_PROFILE"
        const val ACTION_ADD_AND_START = "com.cbv.vpn.ADD_AND_START"
        const val ACTION_START_VPN_BY_NAME = "com.cbv.vpn.START_VPN_BY_NAME"
        const val ACTION_START_VPN_BY_ID = "com.cbv.vpn.START_VPN_BY_ID"
        const val ACTION_STOP_VPN = "com.cbv.vpn.STOP_VPN"
        const val ACTION_GET_STATUS = "com.cbv.vpn.GET_STATUS"
        const val ACTION_PROFILES_UPDATED = "com.cbv.vpn.PROFILES_UPDATED"

        // Network reconnection debounce
        private const val RECONNECT_DELAY_MS = 3000L
        private var lastConnectivityChangeTime = 0L
        private var reconnectHandler: Handler? = null
        private var pendingReconnectRunnable: Runnable? = null

        // Intent extras for ADD_PROFILE
        const val EXTRA_PROFILE_NAME = "profile_name"
        const val EXTRA_PROFILE_HOST = "profile_host"
        const val EXTRA_PROFILE_PORT = "profile_port"
        const val EXTRA_PROFILE_TYPE = "profile_type"
        const val EXTRA_PROFILE_USERNAME = "profile_username"
        const val EXTRA_PROFILE_PASSWORD = "profile_password"
        const val EXTRA_PROFILE_DNS1 = "profile_dns1"
        const val EXTRA_PROFILE_DNS2 = "profile_dns2"

        // Intent extras for START_VPN
        const val EXTRA_PROFILE_ID = "profile_id"

        /**
         * Starts the VPN connection service with the given profile.
         * Shared between the broadcast receiver and VPNPermissionActivity so
         * ADB-triggered flows can complete even when the app isn't already running.
         */
        @JvmStatic
        fun startVpnService(context: Context, profile: JSONObject) {
            val prefs = context.getSharedPreferences("vpn_prefs", Context.MODE_PRIVATE)
            val profileId = profile.getString("id")
            val proxyHost = profile.getString("host")

            // Save this profile as the selected/active profile early
            prefs.edit().putString("selected_profile_id", profileId).apply()
            Log.d(TAG, "💾 Saved active profile: $profileId")

            // Broadcast active profile change to React Native
            val activeProfileIntent =
                    Intent("com.cbv.vpn.ACTIVE_PROFILE_CHANGED").apply {
                        putExtra("profile_id", profileId)
                        putExtra("profile_name", profile.getString("name"))
                    }
            LocalBroadcastManager.getInstance(context).sendBroadcast(activeProfileIntent)
            Log.d(TAG, "📡 Broadcasted active profile change")

            // Stop existing VPN connection first to avoid stale tunnels
            Log.d(TAG, "🛑 Stopping any existing VPN connection...")
            val stopIntent = Intent(context, VPNConnectionService::class.java)
            stopIntent.putExtra("action", "stop")
            // Use context.stopService instead of startService to avoid background service restrictions
            context.stopService(stopIntent)

            // Wait a moment for the stop to complete
            Thread.sleep(500)

            // Check notification permission on Android 13+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val notifGranted =
                        androidx.core.content.ContextCompat.checkSelfPermission(
                                context,
                                android.Manifest.permission.POST_NOTIFICATIONS
                        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
                if (!notifGranted) {
                    prefs.edit().putBoolean("notification_permission_pending", true).apply()
                    Log.w(
                            TAG,
                            "⚠️ POST_NOTIFICATIONS not granted, bringing app to foreground to request"
                    )
                    try {
                        val reqIntent = Intent("com.cbv.vpn.REQUEST_NOTIF_PERMISSION")
                        LocalBroadcastManager.getInstance(context).sendBroadcast(reqIntent)
                    } catch (_: Exception) {}
                    val launchIntent =
                            context.packageManager.getLaunchIntentForPackage(context.packageName)
                    launchIntent?.apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    }
                    if (launchIntent != null) {
                        context.startActivity(launchIntent)
                    }
                    return
                }
                prefs.edit().putBoolean("notification_permission_pending", false).apply()
            }

            Log.d(TAG, "🌐 Resolving proxy hostname: $proxyHost")

            var proxyIP = proxyHost
            try {
                val addr = java.net.InetAddress.getByName(proxyHost)
                proxyIP = addr.hostAddress ?: proxyHost
                Log.d(TAG, "✅ Resolved to IP: $proxyIP")
            } catch (e: Exception) {
                Log.w(TAG, "⚠️ Could not resolve hostname, using as-is: ${e.message}")
            }

            val serviceIntent = Intent(context, VPNConnectionService::class.java)
            serviceIntent.putExtra("server", proxyHost)
            serviceIntent.putExtra("serverIP", proxyIP)
            serviceIntent.putExtra("port", profile.getInt("port"))
            serviceIntent.putExtra("type", profile.optString("type", "socks5"))
            serviceIntent.putExtra("username", profile.optString("username", ""))
            serviceIntent.putExtra("password", profile.optString("password", ""))
            serviceIntent.putExtra("dns1", profile.optString("dns1", "1.1.1.1"))
            serviceIntent.putExtra("dns2", profile.optString("dns2", "8.8.8.8"))

            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }
            } catch (e: Exception) {
                val shouldBringToFront =
                        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                                e.javaClass.simpleName.contains(
                                        "ForegroundServiceStartNotAllowedException"
                                )
                if (shouldBringToFront) {
                    savePendingProfile(context, profile)
                    val launchIntent =
                            context.packageManager.getLaunchIntentForPackage(context.packageName)
                    launchIntent?.apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    }
                    if (launchIntent != null) {
                        context.startActivity(launchIntent)
                    }
                } else {
                    throw e
                }
            }

            Log.d(TAG, "✅ VPN service started successfully")
        }

        @JvmStatic
        fun tryStartPendingProfile(context: Context) {
            val pendingProfile = consumePendingProfile(context) ?: return
            Log.d(TAG, "🔁 Retrying VPN start for pending automation profile")
            startVpnService(context, pendingProfile)
        }

        private fun savePendingProfile(context: Context, profile: JSONObject) {
            try {
                val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit().putString(KEY_PENDING_PROFILE_JSON, profile.toString()).apply()
                Log.d(TAG, "💾 Saved pending automation profile for retry")
            } catch (e: Exception) {
                Log.w(TAG, "⚠️ Failed to save pending profile: ${e.message}")
            }
        }

        private fun consumePendingProfile(context: Context): JSONObject? {
            return try {
                val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val json = prefs.getString(KEY_PENDING_PROFILE_JSON, null)
                if (json.isNullOrEmpty()) {
                    null
                } else {
                    prefs.edit().remove(KEY_PENDING_PROFILE_JSON).apply()
                    JSONObject(json)
                }
            } catch (e: Exception) {
                Log.w(TAG, "⚠️ Failed to read pending profile: ${e.message}")
                null
            }
        }
    }

    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) {
            Log.w(TAG, "Received null context or intent")
            return
        }

        Log.d(TAG, "========================================")
        Log.d(TAG, "📨 Received broadcast intent: ${intent.action}")
        Log.d(TAG, "========================================")

        when (intent.action) {
            ACTION_ADD_PROFILE -> handleAddProfile(context, intent)
            ACTION_ADD_AND_START -> handleAddAndStart(context, intent)
            ACTION_START_VPN_BY_NAME -> handleStartVPNByName(context, intent)
            ACTION_START_VPN_BY_ID -> handleStartVPNById(context, intent)
            ACTION_STOP_VPN -> handleStopVPN(context)
            ACTION_GET_STATUS -> handleGetStatus(context)
            Intent.ACTION_BOOT_COMPLETED, "android.intent.action.QUICKBOOT_POWERON" ->
                    handleBootCompleted(context)
            ConnectivityManager.CONNECTIVITY_ACTION, "android.net.conn.CONNECTIVITY_ACTION" ->
                    handleConnectivityChange(context)
            else -> Log.w(TAG, "⚠️ Unknown action: ${intent.action}")
        }
    }

    private fun handleBootCompleted(context: Context) {
        try {
            Log.d(TAG, "🔄 Device boot completed, checking auto-connect preference...")

            // Check if auto-connect is enabled
            val prefs = context.getSharedPreferences("vpn_prefs", Context.MODE_PRIVATE)
            val autoConnectEnabled = prefs.getBoolean("auto_connect_enabled", false)

            if (!autoConnectEnabled) {
                Log.d(TAG, "⏭️ Auto-connect is disabled, skipping")
                return
            }

            Log.d(TAG, "✅ Auto-connect is enabled, retrieving last connected profile...")

            // Get last connected profile ID
            val lastProfileId = prefs.getString("last_connected_profile_id", null)

            if (lastProfileId == null) {
                Log.w(TAG, "⚠️ No last connected profile found, skipping auto-connect")
                return
            }

            Log.d(TAG, "📋 Last connected profile ID: $lastProfileId")

            // Load profiles to verify the profile exists
            val profilesStr = prefs.getString("profiles", "[]")
            val profiles = JSONArray(profilesStr ?: "[]")

            var targetProfile: JSONObject? = null
            for (i in 0 until profiles.length()) {
                val profile = profiles.getJSONObject(i)
                if (profile.getString("id") == lastProfileId) {
                    targetProfile = profile
                    Log.d(TAG, "✅ Found profile: ${profile.getString("name")}")
                    break
                }
            }

            if (targetProfile == null) {
                Log.w(TAG, "⚠️ Last connected profile not found in saved profiles")
                return
            }

            // Add a delay to ensure system is ready
            Thread.sleep(3000)

            Log.d(
                    TAG,
                    "🚀 Starting VPN auto-connect with profile: ${targetProfile.getString("name")}"
            )

            // Start VPN with the last connected profile
            startVPNWithProfile(context, targetProfile)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error handling boot completed: ${e.message}", e)
        }
    }

    private fun handleConnectivityChange(context: Context) {
        try {
            Log.d(TAG, "📡 Network connectivity changed")

            // Check if auto-connect is enabled
            val prefs = context.getSharedPreferences("vpn_prefs", Context.MODE_PRIVATE)
            val autoConnectEnabled = prefs.getBoolean("auto_connect_enabled", false)

            if (!autoConnectEnabled) {
                Log.d(TAG, "⏭️ Auto-connect is disabled, skipping network reconnect")
                return
            }

            // Check if VPN was manually disconnected by user
            val manuallyDisconnected = prefs.getBoolean("manually_disconnected", false)
            if (manuallyDisconnected) {
                Log.d(TAG, "⏭️ VPN was manually disconnected by user, skipping auto-reconnect")
                return
            }

            // Check if network is now available
            val connectivityManager =
                    context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val isNetworkAvailable = isNetworkAvailable(connectivityManager)

            if (!isNetworkAvailable) {
                Log.d(TAG, "⚠️ Network is not available, skipping reconnect")
                return
            }

            Log.d(TAG, "✅ Network is available, checking VPN status...")

            // Get last connected profile ID
            val lastProfileId = prefs.getString("last_connected_profile_id", null)

            if (lastProfileId == null) {
                Log.d(TAG, "⏭️ No last connected profile found, skipping auto-reconnect")
                return
            }

            // Debounce: Prevent rapid reconnection attempts
            val currentTime = System.currentTimeMillis()
            val timeSinceLastChange = currentTime - lastConnectivityChangeTime

            if (timeSinceLastChange < RECONNECT_DELAY_MS) {
                Log.d(
                        TAG,
                        "⏳ Debouncing network change (${timeSinceLastChange}ms since last change)"
                )
                // Cancel any pending reconnect
                pendingReconnectRunnable?.let { reconnectHandler?.removeCallbacks(it) }
            }

            lastConnectivityChangeTime = currentTime

            // Schedule reconnect with delay
            if (reconnectHandler == null) {
                reconnectHandler = Handler(Looper.getMainLooper())
            }

            pendingReconnectRunnable = Runnable {
                try {
                    Log.d(TAG, "🔄 Attempting auto-reconnect after network change...")

                    // Load profiles to verify the profile exists
                    val profilesStr = prefs.getString("profiles", "[]")
                    val profiles = JSONArray(profilesStr ?: "[]")

                    var targetProfile: JSONObject? = null
                    for (i in 0 until profiles.length()) {
                        val profile = profiles.getJSONObject(i)
                        if (profile.getString("id") == lastProfileId) {
                            targetProfile = profile
                            Log.d(
                                    TAG,
                                    "✅ Found profile for reconnect: ${profile.getString("name")}"
                            )
                            break
                        }
                    }

                    if (targetProfile == null) {
                        Log.w(TAG, "⚠️ Last connected profile not found in saved profiles")
                        return@Runnable
                    }

                    // Start VPN with the last connected profile
                    Log.d(
                            TAG,
                            "🚀 Auto-reconnecting VPN after network change with profile: ${targetProfile.getString("name")}"
                    )
                    startVPNWithProfile(context, targetProfile)
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error during auto-reconnect: ${e.message}", e)
                }
            }

            reconnectHandler?.postDelayed(pendingReconnectRunnable!!, RECONNECT_DELAY_MS)
            Log.d(TAG, "⏰ Scheduled VPN reconnect in ${RECONNECT_DELAY_MS}ms")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error handling connectivity change: ${e.message}", e)
        }
    }

    private fun isNetworkAvailable(connectivityManager: ConnectivityManager): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val network = connectivityManager.activeNetwork ?: return false
                val capabilities =
                        connectivityManager.getNetworkCapabilities(network) ?: return false

                val hasTransport =
                        capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
                                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)

                val hasInternet =
                        capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                val isValidated =
                        capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)

                Log.d(
                        TAG,
                        "Network status: hasTransport=$hasTransport, hasInternet=$hasInternet, isValidated=$isValidated"
                )

                hasTransport && hasInternet && isValidated
            } else {
                @Suppress("DEPRECATION") val networkInfo = connectivityManager.activeNetworkInfo
                val isConnected = networkInfo?.isConnected == true
                Log.d(TAG, "Network status (legacy): isConnected=$isConnected")
                isConnected
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error checking network availability: ${e.message}", e)
            false
        }
    }

    private fun handleAddProfile(context: Context, intent: Intent) {
        try {
            val name = intent.getStringExtra(EXTRA_PROFILE_NAME)
            val host = intent.getStringExtra(EXTRA_PROFILE_HOST)
            val port = intent.getIntExtra(EXTRA_PROFILE_PORT, 1080)
            val type = intent.getStringExtra(EXTRA_PROFILE_TYPE) ?: "socks5"
            val username = intent.getStringExtra(EXTRA_PROFILE_USERNAME) ?: ""
            val password = intent.getStringExtra(EXTRA_PROFILE_PASSWORD) ?: ""
            val dns1 = intent.getStringExtra(EXTRA_PROFILE_DNS1) ?: "1.1.1.1"
            val dns2 = intent.getStringExtra(EXTRA_PROFILE_DNS2) ?: "8.8.8.8"

            if (name.isNullOrEmpty() || host.isNullOrEmpty()) {
                Log.e(TAG, "❌ Missing required parameters: name or host")
                return
            }

            Log.d(TAG, "➕ Adding profile: $name")
            Log.d(TAG, "  - Host: $host")
            Log.d(TAG, "  - Port: $port")
            Log.d(TAG, "  - Type: $type")

            // Load existing profiles
            val prefs = context.getSharedPreferences("vpn_prefs", Context.MODE_PRIVATE)
            val profilesStr = prefs.getString("profiles", "[]")
            val profiles = JSONArray(profilesStr ?: "[]")

            // Check if profile with same name already exists
            var existingProfileId: String? = null
            for (i in 0 until profiles.length()) {
                val profile = profiles.getJSONObject(i)
                if (profile.getString("name") == name) {
                    existingProfileId = profile.getString("id")
                    Log.w(
                            TAG,
                            "⚠️ Profile with name '$name' already exists (ID: $existingProfileId)"
                    )
                    break
                }
            }

            var updatedProfile: JSONObject? = null

            if (existingProfileId != null) {
                // Update existing profile
                val newProfiles = JSONArray()
                for (i in 0 until profiles.length()) {
                    val profile = profiles.getJSONObject(i)
                    if (profile.getString("id") == existingProfileId) {
                        // Update this profile
                        profile.put("host", host)
                        profile.put("port", port)
                        profile.put("type", type)
                        profile.put("username", username)
                        profile.put("password", password)
                        profile.put("dns1", dns1)
                        profile.put("dns2", dns2)
                        Log.d(TAG, "✏️ Updated existing profile: $name")
                        updatedProfile = profile
                    }
                    newProfiles.put(profile)
                }
                prefs.edit().putString("profiles", newProfiles.toString()).apply()
            } else {
                // Create new profile
                val newProfile = JSONObject()
                val profileId = System.currentTimeMillis().toString()
                newProfile.put("id", profileId)
                newProfile.put("name", name)
                newProfile.put("host", host)
                newProfile.put("port", port)
                newProfile.put("type", type)
                newProfile.put("username", username)
                newProfile.put("password", password)
                newProfile.put("dns1", dns1)
                newProfile.put("dns2", dns2)

                profiles.put(newProfile)
                prefs.edit().putString("profiles", profiles.toString()).apply()

                Log.d(TAG, "✅ Profile added successfully with ID: $profileId")
                updatedProfile = newProfile
            }

            updatedProfile?.let { profile ->
                try {
                    val broadcastIntent =
                            Intent(ACTION_PROFILES_UPDATED).apply {
                                putExtra("profile_id", profile.getString("id"))
                                putExtra("profile_name", profile.getString("name"))
                                putExtra("profile_host", profile.getString("host"))
                                putExtra("profile_port", profile.getInt("port"))
                                putExtra("profile_type", profile.optString("type", "socks5"))
                                putExtra("has_auth", profile.optString("username", "").isNotEmpty())
                                putExtra("is_update", existingProfileId != null)
                            }
                    LocalBroadcastManager.getInstance(context).sendBroadcast(broadcastIntent)
                    Log.d(TAG, "📡 Broadcasted profiles update for ${profile.getString("name")}")
                } catch (e: Exception) {
                    Log.w(TAG, "⚠️ Failed to broadcast profile update: ${e.message}", e)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error adding profile: ${e.message}", e)
        }
    }

    private fun handleAddAndStart(context: Context, intent: Intent) {
        try {
            Log.d(TAG, "🚀 ADD_AND_START requested")

            // 1. Stop existing VPN connection first
            Log.d(TAG, "🛑 Stopping any existing VPN connection before update...")
            val stopIntent = Intent(context, VPNConnectionService::class.java)
            stopIntent.putExtra("action", "stop")
            // Use context.stopService instead of startService to avoid background service restrictions
            context.stopService(stopIntent)

            // 2. Wait a moment for the stop to complete
            // This is a simple blocking wait, which is acceptable in a BroadcastReceiver
            // for a short duration if it ensures clean state
            Thread.sleep(1000)

            // 3. Add or update the profile
            handleAddProfile(context, intent)

            val name = intent.getStringExtra(EXTRA_PROFILE_NAME)
            if (name.isNullOrEmpty()) {
                Log.e(TAG, "❌ Missing profile_name parameter for ADD_AND_START")
                return
            }

            Log.d(TAG, "🚀 Starting VPN for: $name")

            // Reload profiles to get the latest data
            val prefs = context.getSharedPreferences("vpn_prefs", Context.MODE_PRIVATE)
            val profilesStr = prefs.getString("profiles", "[]")
            val profiles = JSONArray(profilesStr ?: "[]")

            var targetProfile: JSONObject? = null
            for (i in 0 until profiles.length()) {
                val profile = profiles.getJSONObject(i)
                if (profile.getString("name") == name) {
                    targetProfile = profile
                    Log.d(TAG, "✅ Found profile for ADD_AND_START: ${profile.getString("name")}")
                    break
                }
            }

            if (targetProfile == null) {
                Log.e(TAG, "❌ Profile not found after add: $name")
                return
            }

            // 4. Start VPN with the updated profile
            startVPNWithProfile(context, targetProfile)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error handling ADD_AND_START: ${e.message}", e)
        }
    }

    private fun handleStartVPNByName(context: Context, intent: Intent) {
        try {
            val profileName = intent.getStringExtra(EXTRA_PROFILE_NAME)
            if (profileName.isNullOrEmpty()) {
                Log.e(TAG, "❌ Missing profile_name parameter")
                return
            }

            Log.d(TAG, "🔍 Looking for profile: $profileName")

            // Load profiles
            val prefs = context.getSharedPreferences("vpn_prefs", Context.MODE_PRIVATE)
            val profilesStr = prefs.getString("profiles", "[]")
            val profiles = JSONArray(profilesStr ?: "[]")

            // Find profile by name
            var targetProfile: JSONObject? = null
            for (i in 0 until profiles.length()) {
                val profile = profiles.getJSONObject(i)
                if (profile.getString("name") == profileName) {
                    targetProfile = profile
                    Log.d(TAG, "✅ Found profile: $profileName")
                    break
                }
            }

            if (targetProfile == null) {
                Log.e(TAG, "❌ Profile not found: $profileName")
                return
            }

            // Start VPN with this profile
            startVPNWithProfile(context, targetProfile)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error starting VPN by name: ${e.message}", e)
        }
    }

    private fun handleStartVPNById(context: Context, intent: Intent) {
        try {
            val profileId = intent.getStringExtra(EXTRA_PROFILE_ID)
            if (profileId.isNullOrEmpty()) {
                Log.e(TAG, "❌ Missing profile_id parameter")
                return
            }

            Log.d(TAG, "🔍 Looking for profile ID: $profileId")

            // Load profiles
            val prefs = context.getSharedPreferences("vpn_prefs", Context.MODE_PRIVATE)
            val profilesStr = prefs.getString("profiles", "[]")
            val profiles = JSONArray(profilesStr ?: "[]")

            // Find profile by ID
            var targetProfile: JSONObject? = null
            for (i in 0 until profiles.length()) {
                val profile = profiles.getJSONObject(i)
                if (profile.getString("id") == profileId) {
                    targetProfile = profile
                    Log.d(TAG, "✅ Found profile: ${profile.getString("name")}")
                    break
                }
            }

            if (targetProfile == null) {
                Log.e(TAG, "❌ Profile not found with ID: $profileId")
                return
            }

            // Start VPN with this profile
            startVPNWithProfile(context, targetProfile)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error starting VPN by ID: ${e.message}", e)
        }
    }

    private fun handleStopVPN(context: Context) {
        try {
            Log.d(TAG, "🛑 Stopping VPN...")

            // Mark as manually disconnected to prevent auto-reconnect
            val prefs = context.getSharedPreferences("vpn_prefs", Context.MODE_PRIVATE)
            prefs.edit().putBoolean("manually_disconnected", true).apply()
            prefs.edit().putBoolean("automation_session_active", false).apply()
            Log.d(TAG, "💾 Marked VPN as manually disconnected")

            val serviceIntent = Intent(context, VPNConnectionService::class.java)
            serviceIntent.putExtra("action", "stop")
            serviceIntent.putExtra("force", true)
            context.startService(serviceIntent)
            Log.d(TAG, "✅ Stop VPN command sent")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error stopping VPN: ${e.message}", e)
        }
    }

    private fun handleGetStatus(context: Context) {
        try {
            Log.d(TAG, "📊 Requesting VPN status...")
            val serviceIntent = Intent(context, VPNConnectionService::class.java)
            serviceIntent.putExtra("action", VPNConnectionService.COMMAND_STATUS)
            context.startService(serviceIntent)
            Log.d(TAG, "✅ Status request sent")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error getting status: ${e.message}", e)
        }
    }

    private fun startVPNWithProfile(context: Context, profile: JSONObject) {
        try {
            Log.d(TAG, "🚀 Starting VPN with profile: ${profile.getString("name")}")

            // Clear manually disconnected flag when starting VPN
            val prefs = context.getSharedPreferences("vpn_prefs", Context.MODE_PRIVATE)
            prefs.edit().putBoolean("manually_disconnected", false).apply()
            // Mark that this session was started via automation (ADB)
            prefs.edit().putBoolean("automation_session_active", true).apply()
            
            // Enable auto-connect when started via ADB/automation
            // This ensures VPN will auto-reconnect if connection drops
            prefs.edit().putBoolean("auto_connect_enabled", true).apply()
            Log.d(TAG, "💾 Cleared manually disconnected flag and enabled auto-connect")

            // Save this profile as the last connected profile
            prefs.edit().putString("last_connected_profile_id", profile.getString("id")).apply()
            Log.d(TAG, "💾 Saved as last connected profile: ${profile.getString("id")}")

            // Check if VPN permission is granted
            val prepareIntent = VpnService.prepare(context)

            if (prepareIntent != null) {
                // VPN permission not granted - need to open app and request permission
                Log.w(TAG, "⚠️ VPN permission not granted, opening app to request permission")

                // Broadcast to React Native to trigger permission request
                val broadcastIntent =
                        Intent("com.cbv.vpn.REQUEST_VPN_PERMISSION").apply {
                            putExtra("profile_id", profile.getString("id"))
                            putExtra("profile_name", profile.getString("name"))
                        }
                LocalBroadcastManager.getInstance(context).sendBroadcast(broadcastIntent)

                // Open lightweight permission activity so ADB calls can complete
                try {
                    val permissionIntent = Intent(context, VPNPermissionActivity::class.java).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        putExtra(
                                VPNPermissionActivity.EXTRA_PROFILE_JSON,
                                profile.toString()
                        )
                    }
                    context.startActivity(permissionIntent)
                    Log.d(
                            TAG,
                            "📱 Launched VPNPermissionActivity to request VPN permission automatically"
                    )
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Failed to launch VPNPermissionActivity: ${e.message}", e)

                    // Fallback: Open the app root so user can approve manually
                    val launchIntent =
                            context.packageManager.getLaunchIntentForPackage(context.packageName)
                    launchIntent?.apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    }
                    if (launchIntent != null) {
                        context.startActivity(launchIntent)
                    }
                }

                Log.d(TAG, "📱 App opened, waiting for user to grant VPN permission")
                return
            }

            // Permission already granted, start VPN service directly
            startVpnService(context, profile)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error starting VPN service: ${e.message}", e)
        }
    }
}
