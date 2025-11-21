package com.cbv.vpn

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import android.os.Bundle
import android.util.Log
import org.json.JSONObject

/**
 * Lightweight activity to request VPN permission when triggered from ADB broadcasts.
 * Once the user approves, it starts the VPN connection with the provided profile.
 */
class VPNPermissionActivity : Activity() {
    companion object {
        private const val TAG = "VPNPermissionActivity"
        const val EXTRA_PROFILE_JSON = "profile_json"
        private const val REQUEST_CODE_VPN_PERMISSION = 2001
    }

    private var profileJson: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        profileJson = intent.getStringExtra(EXTRA_PROFILE_JSON)
        if (profileJson.isNullOrEmpty()) {
            Log.e(TAG, "❌ Missing profile data for VPN permission request")
            finish()
            return
        }

        requestVpnPermission()
    }

    private fun requestVpnPermission() {
        try {
            val prepareIntent = VpnService.prepare(this)
            if (prepareIntent != null) {
                Log.d(TAG, "📄 Requesting VPN permission from user")
                startActivityForResult(prepareIntent, REQUEST_CODE_VPN_PERMISSION)
            } else {
                Log.d(TAG, "✅ VPN permission already granted (permission activity)")
                startVpnAfterPermission()
                finish()
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error requesting VPN permission: ${e.message}", e)
            finish()
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_CODE_VPN_PERMISSION) {
            if (resultCode == RESULT_OK) {
                Log.d(TAG, "✅ VPN permission granted by user")
                startVpnAfterPermission()
            } else {
                Log.w(TAG, "⚠️ VPN permission denied or cancelled")
            }
            finish()
        }
    }

    private fun startVpnAfterPermission() {
        try {
            val profile = JSONObject(profileJson!!)
            VPNIntentReceiver.startVpnService(this, profile)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to start VPN after permission: ${e.message}", e)
        }
    }
}
