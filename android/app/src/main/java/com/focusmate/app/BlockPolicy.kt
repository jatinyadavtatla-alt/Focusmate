package com.focusmate.app

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager

/**
 * Shared rules for what may be blocked and whether blocking is currently in force.
 * State lives in SharedPreferences so the AccessibilityService keeps working even if the
 * React Native runtime is not running.
 */
object BlockPolicy {
    const val PREFS = "focusmate_prefs"
    const val KEY_ACTIVE = "is_session_active"
    const val KEY_UNTIL = "block_until_ms"
    const val KEY_PACKAGES = "blocked_packages"
    const val KEY_STRICT = "strict_mode"

    /** Dead-man switch for open-ended blocks, so a crashed app can never lock the phone indefinitely. */
    const val MAX_OPEN_BLOCK_MS = 12L * 60L * 60L * 1000L

    /** Never blocked: lets the user always reach Settings (to disable the service), the system UI and emergency apps. */
    private val ALWAYS_SAFE = setOf(
        "com.android.settings",
        "com.android.systemui",
        "android",
        "com.android.emergency",
        "com.google.android.apps.safetyhub"
    )

    fun protectedPackages(context: Context): Set<String> {
        val result = HashSet<String>(ALWAYS_SAFE)
        result.add(context.packageName)
        val pm = context.packageManager
        val probes = listOf(
            Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME),
            Intent(Intent.ACTION_DIAL)
        )
        for (probe in probes) {
            try {
                pm.resolveActivity(probe, PackageManager.MATCH_DEFAULT_ONLY)
                    ?.activityInfo?.packageName?.let { result.add(it) }
            } catch (_: Exception) {
            }
        }
        return result
    }

    fun isBlockingNow(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(KEY_ACTIVE, false)) return false
        return System.currentTimeMillis() <= prefs.getLong(KEY_UNTIL, 0L)
    }
}
