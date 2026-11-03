package com.focusmate.app

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent

class FocusAccessibilityService : AccessibilityService() {

    private val handler = Handler(Looper.getMainLooper())
    private var protectedPackages: Set<String> = emptySet()
    private var lastBlockedPkg: String? = null
    private var lastBlockedAt = 0L

    override fun onServiceConnected() {
        super.onServiceConnected()
        protectedPackages = BlockPolicy.protectedPackages(this)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null || event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkgName = event.packageName?.toString() ?: return

        // Cheap checks first: this runs on every window change on the device.
        if (pkgName == packageName) return
        if (!BlockPolicy.isBlockingNow(this)) return

        val prefs = getSharedPreferences(BlockPolicy.PREFS, Context.MODE_PRIVATE)
        val blockedSet = prefs.getStringSet(BlockPolicy.KEY_PACKAGES, emptySet()) ?: emptySet()
        if (!blockedSet.contains(pkgName)) return

        if (protectedPackages.isEmpty()) protectedPackages = BlockPolicy.protectedPackages(this)
        if (protectedPackages.contains(pkgName)) return

        // A single app launch can emit several window events; react once.
        val now = System.currentTimeMillis()
        if (pkgName == lastBlockedPkg && now - lastBlockedAt < 1500) return
        lastBlockedPkg = pkgName
        lastBlockedAt = now

        // 1) Always works from an accessibility service: send the distracting app away.
        performGlobalAction(GLOBAL_ACTION_HOME)

        // 2) Then show the FocusMate block screen. Background activity starts can be denied by the
        //    OS on newer Android versions, so failure here is non-fatal: the app is already gone.
        handler.postDelayed({
            try {
                val blockIntent = Intent(this, BlockedAppActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    putExtra("BLOCKED_PACKAGE", pkgName)
                }
                startActivity(blockIntent)
            } catch (_: Exception) {
            }
        }, 150)
    }

    override fun onInterrupt() {
        handler.removeCallbacksAndMessages(null)
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }
}
