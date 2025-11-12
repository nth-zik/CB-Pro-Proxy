package com.cbv.vpn

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.util.Log
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import org.json.JSONArray
import org.json.JSONObject

class VPNIntentReceiver : BroadcastReceiver() {
    
    companion object {
        private const val TAG = "VPNIntentReceiver"
        
        // Intent actions
        const val ACTION_ADD_PROFILE = "com.cbv.vpn.ADD_PROFILE"
        const val ACTION_START_VPN_BY_NAME = "com.cbv.vpn.START_VPN_BY_NAME"
        const val ACTION_START_VPN_BY_ID = "com.cbv.vpn.START_VPN_BY_ID"
        const val ACTION_STOP_VPN = "com.cbv.vpn.STOP_VPN"
        const val ACTION_GET_STATUS = "com.cbv.vpn.GET_STATUS"
        const val ACTION_PROFILES_UPDATED = "com.cbv.vpn.PROFILES_UPDATED"
        
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
            ACTION_START_VPN_BY_NAME -> handleStartVPNByName(context, intent)
            ACTION_START_VPN_BY_ID -> handleStartVPNById(context, intent)
            ACTION_STOP_VPN -> handleStopVPN(context)
            ACTION_GET_STATUS -> handleGetStatus(context)
            else -> Log.w(TAG, "⚠️ Unknown action: ${intent.action}")
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
                    Log.w(TAG, "⚠️ Profile with name '$name' already exists (ID: $existingProfileId)")
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
                    val broadcastIntent = Intent(ACTION_PROFILES_UPDATED).apply {
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
            val serviceIntent = Intent(context, VPNConnectionService::class.java)
            serviceIntent.putExtra("action", "stop")
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
            
            // Check if VPN permission is granted
            val prepareIntent = VpnService.prepare(context)
            
            if (prepareIntent != null) {
                // VPN permission not granted - need to open app and request permission
                Log.w(TAG, "⚠️ VPN permission not granted, opening app to request permission")
                
                // Broadcast to React Native to trigger permission request
                val broadcastIntent = Intent("com.cbv.vpn.REQUEST_VPN_PERMISSION").apply {
                    putExtra("profile_id", profile.getString("id"))
                    putExtra("profile_name", profile.getString("name"))
                }
                LocalBroadcastManager.getInstance(context).sendBroadcast(broadcastIntent)
                
                // Open the app
                val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
                launchIntent?.apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                context.startActivity(launchIntent)
                
                Log.d(TAG, "📱 App opened, waiting for user to grant VPN permission")
                return
            }
            
            // Stop existing VPN connection first
            Log.d(TAG, "🛑 Stopping any existing VPN connection...")
            val stopIntent = Intent(context, VPNConnectionService::class.java)
            stopIntent.putExtra("action", "stop")
            context.startService(stopIntent)
            
            // Wait a moment for the stop to complete
            Thread.sleep(500)
            
            // Permission already granted, start VPN service directly
            val profileId = profile.getString("id")
            val proxyHost = profile.getString("host")
            
            // Save this profile as the selected/active profile
            val prefs = context.getSharedPreferences("vpn_prefs", Context.MODE_PRIVATE)
            prefs.edit().putString("selected_profile_id", profileId).apply()
            Log.d(TAG, "💾 Saved active profile: $profileId")
            
            // Broadcast active profile change to React Native
            val activeProfileIntent = Intent("com.cbv.vpn.ACTIVE_PROFILE_CHANGED").apply {
                putExtra("profile_id", profileId)
                putExtra("profile_name", profile.getString("name"))
            }
            LocalBroadcastManager.getInstance(context).sendBroadcast(activeProfileIntent)
            Log.d(TAG, "📡 Broadcasted active profile change")
            
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
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
            
            Log.d(TAG, "✅ VPN service started successfully")
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error starting VPN service: ${e.message}", e)
        }
    }
}
