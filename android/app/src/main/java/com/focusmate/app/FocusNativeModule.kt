package com.focusmate.app

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.VpnService
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.Process
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.text.TextUtils
import android.util.Base64
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import java.io.ByteArrayOutputStream

class FocusNativeModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "FocusNativeModule"

    @ReactMethod
    fun checkPermissions(promise: Promise) {
        try {
            val result = Arguments.createMap().apply {
                putBoolean("accessibility", isAccessibilityServiceEnabled())
                putBoolean("usageStats", isUsageStatsPermissionGranted())
                putBoolean("overlay", isOverlayPermissionGranted())
                putBoolean("notifications", isNotificationPermissionGranted())
                putBoolean("batteryOptimization", isBatteryOptimizationIgnored())
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERR_PERMISSION_CHECK", e.message, e)
        }
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        val globallyOn = try {
            Settings.Secure.getInt(reactContext.contentResolver, Settings.Secure.ACCESSIBILITY_ENABLED, 0) == 1
        } catch (_: Exception) {
            false
        }
        if (!globallyOn) return false
        val expectedServiceName = "${reactContext.packageName}/${FocusAccessibilityService::class.java.canonicalName}"
        val enabledServices = Settings.Secure.getString(
            reactContext.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false

        val colonSplitter = TextUtils.SimpleStringSplitter(':')
        colonSplitter.setString(enabledServices)
        while (colonSplitter.hasNext()) {
            val componentName = colonSplitter.next()
            if (componentName.equals(expectedServiceName, ignoreCase = true) ||
                componentName.contains(FocusAccessibilityService::class.java.simpleName)
            ) {
                return true
            }
        }
        return false
    }

    private fun isUsageStatsPermissionGranted(): Boolean {
        val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as? AppOpsManager ?: return false
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                reactContext.packageName
            )
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                reactContext.packageName
            )
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    private fun isOverlayPermissionGranted(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(reactContext)
        } else {
            true
        }
    }

    private fun isNotificationPermissionGranted(): Boolean {
        return NotificationManagerCompat.from(reactContext).areNotificationsEnabled()
    }

    private fun isBatteryOptimizationIgnored(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = reactContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
            return pm?.isIgnoringBatteryOptimizations(reactContext.packageName) ?: false
        }
        return true
    }

    @ReactMethod
    fun requestAccessibilityPermission() {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactContext.startActivity(intent)
    }

    @ReactMethod
    fun requestUsageStatsPermission() {
        val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactContext.startActivity(intent)
    }

    @ReactMethod
    fun requestOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${reactContext.packageName}")
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
        }
    }

    @ReactMethod
    fun requestBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(
                Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                Uri.parse("package:${reactContext.packageName}")
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
        }
    }

    @ReactMethod
    fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, reactContext.packageName)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
        }
    }

    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val pm = reactContext.packageManager
            val launcherIntent = Intent(Intent.ACTION_MAIN, null).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
            }
            val resolveInfos = pm.queryIntentActivities(launcherIntent, 0)
            val protectedPkgs = BlockPolicy.protectedPackages(reactContext)
            val appList = Arguments.createArray()
            val seenPackages = HashSet<String>()

            for (info in resolveInfos) {
                val pkgName = info.activityInfo.packageName
                if (pkgName == reactContext.packageName || seenPackages.contains(pkgName)) {
                    continue
                }
                seenPackages.add(pkgName)

                val appName = info.loadLabel(pm).toString()
                val isSystem = (info.activityInfo.applicationInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0

                val item = Arguments.createMap().apply {
                    putString("packageName", pkgName)
                    putString("appName", appName)
                    putBoolean("isSystem", isSystem)
                    putBoolean("isProtected", protectedPkgs.contains(pkgName))
                    putString("iconBase64", iconToBase64(info.loadIcon(pm)))
                }
                appList.pushMap(item)
            }
            promise.resolve(appList)
        } catch (e: Exception) {
            promise.reject("ERR_GET_APPS", e.message, e)
        }
    }

    private fun iconToBase64(drawable: android.graphics.drawable.Drawable?): String? {
        if (drawable == null) return null
        return try {
            val size = 72
            val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            drawable.setBounds(0, 0, size, size)
            drawable.draw(canvas)
            val out = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
            bitmap.recycle()
            Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        } catch (_: Exception) {
            null
        }
    }

    /**
     * @param isActive true while app blocking should be enforced (a focus phase, not a break).
     * @param plannedSeconds seconds the phase lasts; pass 0 for open-ended / paused phases, which
     *        fall back to a bounded 12h safety window.
     */
    @ReactMethod
    fun syncSessionState(
        isActive: Boolean,
        strictMode: Boolean,
        plannedSeconds: Int,
        elapsedSeconds: Int,
        sessionType: String
    ) {
        val now = System.currentTimeMillis()
        val until = when {
            !isActive -> 0L
            plannedSeconds > 0 -> now + Math.max(0, plannedSeconds - elapsedSeconds) * 1000L
            else -> now + BlockPolicy.MAX_OPEN_BLOCK_MS
        }
        val prefs = reactContext.getSharedPreferences(BlockPolicy.PREFS, Context.MODE_PRIVATE)
        prefs.edit().apply {
            putBoolean(BlockPolicy.KEY_ACTIVE, isActive)
            putLong(BlockPolicy.KEY_UNTIL, until)
            putBoolean(BlockPolicy.KEY_STRICT, strictMode)
            putInt("planned_seconds", plannedSeconds)
            putInt("current_elapsed_seconds", elapsedSeconds)
            putString("session_type", sessionType)
            apply()
        }
    }

    @ReactMethod
    fun syncPreferences(soundEnabled: Boolean, vibrationEnabled: Boolean) {
        reactContext.getSharedPreferences(BlockPolicy.PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean("sound_enabled", soundEnabled)
            .putBoolean("vibration_enabled", vibrationEnabled)
            .apply()
    }

    @ReactMethod
    fun notifyPhaseComplete(sessionType: String) {
        try {
            CompletionCue.fire(reactContext, sessionType)
        } catch (_: Exception) {
        }
    }

    @ReactMethod
    fun isTimerServiceRunning(promise: Promise) {
        promise.resolve(FocusTimerService.isRunning)
    }

    @ReactMethod
    fun syncBlockedPackages(packages: ReadableArray) {
        val set = HashSet<String>()
        for (i in 0 until packages.size()) {
            packages.getString(i)?.let { set.add(it) }
        }
        val prefs = reactContext.getSharedPreferences(BlockPolicy.PREFS, Context.MODE_PRIVATE)
        prefs.edit().putStringSet(BlockPolicy.KEY_PACKAGES, set).apply()
    }

    @ReactMethod
    fun startTimerService(sessionType: String, totalSeconds: Int, elapsedSeconds: Int, paused: Boolean) {
        val intent = Intent(reactContext, FocusTimerService::class.java).apply {
            action = FocusTimerService.ACTION_START
            putExtra("SESSION_TYPE", sessionType)
            putExtra("TOTAL_SECONDS", totalSeconds)
            putExtra("ELAPSED_SECONDS", elapsedSeconds)
            putExtra("PAUSED", paused)
        }
        try {
            // A service that is already foreground can be re-commanded with startService even when the
            // app is in the background (e.g. the next Pomodoro phase starting with the screen off).
            if (FocusTimerService.isRunning || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                reactContext.startService(intent)
            } else {
                reactContext.startForegroundService(intent)
            }
        } catch (_: Exception) {
            // Android may refuse a foreground-service start from the background. The session itself is
            // unaffected (SQLite timestamps); only the ongoing notification is missing.
        }
    }

    @ReactMethod
    fun pauseTimerService() = sendServiceAction(FocusTimerService.ACTION_PAUSE)

    @ReactMethod
    fun resumeTimerService() = sendServiceAction(FocusTimerService.ACTION_RESUME)

    @ReactMethod
    fun stopTimerService() = sendServiceAction(FocusTimerService.ACTION_STOP)

    private fun sendServiceAction(serviceAction: String) {
        // Pause/resume/stop only make sense for a running service; never spin one up just to stop it.
        if (!FocusTimerService.isRunning) {
            if (serviceAction == FocusTimerService.ACTION_STOP) {
                reactContext.getSharedPreferences(BlockPolicy.PREFS, Context.MODE_PRIVATE)
                    .edit().putBoolean(BlockPolicy.KEY_ACTIVE, false).apply()
            }
            return
        }
        try {
            val intent = Intent(reactContext, FocusTimerService::class.java).apply { action = serviceAction }
            reactContext.startService(intent)
        } catch (_: Exception) {
        }
    }

    @ReactMethod
    fun playCompletionCue(sound: Boolean, vibrate: Boolean) {
        if (vibrate) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val vm = reactContext.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                    vm?.defaultVibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 120, 70, 180), -1))
                } else {
                    @Suppress("DEPRECATION")
                    val v = reactContext.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                    v?.vibrate(longArrayOf(0, 120, 70, 180), -1)
                }
            } catch (_: Exception) {}
        }
        if (sound) {
            try {
                val notificationUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                val ringtone = RingtoneManager.getRingtone(reactContext, notificationUri)
                ringtone?.play()
            } catch (_: Exception) {}
        }
    }

    // ---- Website blocking (local DNS filter over VpnService) ------------------------------

    @ReactMethod
    fun isVpnPrepared(promise: Promise) {
        try {
            promise.resolve(VpnService.prepare(reactContext) == null)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    /** Shows the system "Connection request" dialog. Re-check isVpnPrepared() when the app resumes. */
    @ReactMethod
    fun requestVpnPermission() {
        try {
            val intent = VpnService.prepare(reactContext) ?: return
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
        } catch (_: Exception) {
        }
    }

    @ReactMethod
    fun syncBlockedDomains(domains: ReadableArray) {
        val set = HashSet<String>()
        for (i in 0 until domains.size()) {
            domains.getString(i)?.let { DnsFilter.normalizeDomain(it) }?.let { set.add(it) }
        }
        reactContext.getSharedPreferences(BlockPolicy.PREFS, Context.MODE_PRIVATE)
            .edit().putStringSet(FocusVpnService.KEY_DOMAINS, set).apply()
    }

    /** Starts or stops the filter. Starting without VPN consent is a no-op. */
    @ReactMethod
    fun setWebsiteBlockingActive(active: Boolean) {
        try {
            if (active) {
                if (VpnService.prepare(reactContext) != null) return
                reactContext.startService(Intent(reactContext, FocusVpnService::class.java).apply {
                    action = FocusVpnService.ACTION_START
                })
            } else if (FocusVpnService.isRunning) {
                reactContext.startService(Intent(reactContext, FocusVpnService::class.java).apply {
                    action = FocusVpnService.ACTION_STOP
                })
            }
        } catch (_: Exception) {
        }
    }
}
