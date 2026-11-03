package com.focusmate.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat

/**
 * One routine for "a phase just ended": vibration, sound and a notification.
 * Called by the timer service (works with the app closed) AND by the JS layer (when it observes the
 * end first). A short de-duplication window guarantees the user gets exactly one cue either way.
 */
object CompletionCue {
    const val TIMER_CHANNEL_ID = "focusmate_timer_channel"
    const val ALERT_CHANNEL_ID = "focusmate_alert_channel"
    const val COMPLETION_NOTIFICATION_ID = 1002
    private const val KEY_LAST_CUE = "last_cue_ms"
    private const val DEDUPE_MS = 5_000L

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val timer = NotificationChannel(TIMER_CHANNEL_ID, "FocusMate Timer", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Shows the ongoing focus countdown"
            setShowBadge(false)
        }
        // Sound/vibration come from this class (respecting the in-app toggles), so the channel is silent.
        val alert = NotificationChannel(ALERT_CHANNEL_ID, "Session complete", NotificationManager.IMPORTANCE_DEFAULT).apply {
            description = "Tells you when a focus block or break ends"
            setSound(null, null)
            enableVibration(false)
        }
        manager.createNotificationChannel(timer)
        manager.createNotificationChannel(alert)
    }

    /** @return true if the cue fired, false if it was suppressed as a duplicate. */
    @Synchronized
    fun fire(context: Context, sessionType: String): Boolean {
        val prefs = context.getSharedPreferences(BlockPolicy.PREFS, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        if (now - prefs.getLong(KEY_LAST_CUE, 0L) < DEDUPE_MS) return false
        prefs.edit().putLong(KEY_LAST_CUE, now).apply()

        if (prefs.getBoolean("vibration_enabled", true)) vibrate(context)
        if (prefs.getBoolean("sound_enabled", false)) playSound(context)
        postNotification(context, sessionType)
        return true
    }

    private fun postNotification(context: Context, sessionType: String) {
        ensureChannels(context)
        val (title, text) = when (sessionType) {
            "pomodoro_focus" -> "Focus block complete" to "Nice work. Time for a break."
            "short_break", "long_break" -> "Break's over" to "Ready to focus again?"
            else -> "Focus block complete" to "Nicely done. Take a breath before your next block."
        }
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pending = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(context, ALERT_CHANNEL_ID)
            .setContentTitle("FocusMate · $title")
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_stat_focus)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build()
        try {
            // Silently skipped by the OS if the user denied notifications; the cue above still happened.
            (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                .notify(COMPLETION_NOTIFICATION_ID, notification)
        } catch (_: Exception) {
        }
    }

    private fun vibrate(context: Context) {
        try {
            val pattern = longArrayOf(0, 200, 100, 300)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vm?.defaultVibrator?.vibrate(VibrationEffect.createWaveform(pattern, -1))
            } else {
                @Suppress("DEPRECATION")
                val v = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                @Suppress("DEPRECATION")
                v?.vibrate(pattern, -1)
            }
        } catch (_: Exception) {
        }
    }

    private fun playSound(context: Context) {
        try {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            RingtoneManager.getRingtone(context.applicationContext, uri)?.play()
        } catch (_: Exception) {
        }
    }
}
