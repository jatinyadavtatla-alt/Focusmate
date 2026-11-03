package com.focusmate.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import androidx.core.app.NotificationCompat

/**
 * Foreground service that keeps the process alive during a session, shows the ongoing
 * countdown, and fires the completion cue. Time is derived from SystemClock.elapsedRealtime(),
 * never from counting ticks, so it cannot drift. The React Native layer (SQLite) remains the
 * source of truth for the session itself.
 */
class FocusTimerService : Service() {

    companion object {
        const val CHANNEL_ID = CompletionCue.TIMER_CHANNEL_ID
        const val NOTIFICATION_ID = 1001

        const val ACTION_START = "com.focusmate.app.ACTION_START"
        const val ACTION_PAUSE = "com.focusmate.app.ACTION_PAUSE"
        const val ACTION_RESUME = "com.focusmate.app.ACTION_RESUME"
        const val ACTION_STOP = "com.focusmate.app.ACTION_STOP"

        /** After a Pomodoro phase ends, stay alive this long so the app can start the next phase. */
        private const val GRACE_MS = 20_000L

        @Volatile
        var isRunning: Boolean = false
    }

    private val handler = Handler(Looper.getMainLooper())
    private var totalSeconds = 0
    private var baseElapsed = 0
    private var runningSince = 0L
    private var isPaused = false
    private var sessionType = "focus"
    private var wakeLock: PowerManager.WakeLock? = null

    private fun elapsedNow(): Int {
        if (isPaused || runningSince == 0L) return baseElapsed
        return baseElapsed + ((SystemClock.elapsedRealtime() - runningSince) / 1000L).toInt()
    }

    private fun remainingOrElapsed(): Int {
        val el = elapsedNow()
        return if (totalSeconds > 0) Math.max(0, totalSeconds - el) else el
    }

    private val tick = object : Runnable {
        override fun run() {
            if (isPaused) return
            if (totalSeconds > 0 && elapsedNow() >= totalSeconds) {
                onTimerFinished()
                return
            }
            updateNotification()
            handler.postDelayed(this, 1000)
        }
    }

    private val graceStop = Runnable { stopTimer() }

    override fun onCreate() {
        super.onCreate()
        CompletionCue.ensureChannels(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        if (action == null) {
            // Restarted by the system without state: never invent a timer.
            stopSelf()
            return START_NOT_STICKY
        }

        when (action) {
            ACTION_START -> {
                handler.removeCallbacks(graceStop)
                handler.removeCallbacks(tick)
                totalSeconds = intent.getIntExtra("TOTAL_SECONDS", 0)
                baseElapsed = intent.getIntExtra("ELAPSED_SECONDS", 0)
                sessionType = intent.getStringExtra("SESSION_TYPE") ?: "focus"
                isPaused = intent.getBooleanExtra("PAUSED", false)
                runningSince = if (isPaused) 0L else SystemClock.elapsedRealtime()
                promoteToForeground()
                if (!isPaused) {
                    acquireWakeLock()
                    handler.postDelayed(tick, 1000)
                }
            }
            ACTION_PAUSE -> {
                if (!isPaused) {
                    baseElapsed = elapsedNow()
                    isPaused = true
                    runningSince = 0L
                    handler.removeCallbacks(tick)
                    releaseWakeLock()
                    updateNotification()
                }
            }
            ACTION_RESUME -> {
                if (isPaused) {
                    isPaused = false
                    runningSince = SystemClock.elapsedRealtime()
                    acquireWakeLock()
                    updateNotification()
                    handler.removeCallbacks(tick)
                    handler.postDelayed(tick, 1000)
                }
            }
            ACTION_STOP -> stopTimer()
        }
        return START_NOT_STICKY
    }

    private fun promoteToForeground() {
        isRunning = true
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun keepsAliveForNextPhase(): Boolean =
        sessionType == "pomodoro_focus" || sessionType == "short_break" || sessionType == "long_break"

    private fun onTimerFinished() {
        handler.removeCallbacks(tick)
        releaseWakeLock()

        // The phase is over: app blocking ends with it. The app re-arms it if a focus phase follows.
        getSharedPreferences(BlockPolicy.PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(BlockPolicy.KEY_ACTIVE, false).apply()

        // De-duplicated against the JS layer, which may have noticed the end first.
        CompletionCue.fire(this, sessionType)

        if (keepsAliveForNextPhase()) {
            handler.postDelayed(graceStop, GRACE_MS)
        } else {
            stopTimer()
        }
    }

    private fun stopTimer() {
        handler.removeCallbacks(tick)
        handler.removeCallbacks(graceStop)
        releaseWakeLock()
        isRunning = false
        val prefs = getSharedPreferences(BlockPolicy.PREFS, Context.MODE_PRIVATE)
        prefs.edit().putBoolean(BlockPolicy.KEY_ACTIVE, false).apply()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun acquireWakeLock() {
        try {
            releaseWakeLock()
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            val lock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "focusmate:timer")
            lock.setReferenceCounted(false)
            // Bounded so a bug can never hold the CPU awake forever.
            val ms = if (totalSeconds > 0) (totalSeconds - elapsedNow() + 30) * 1000L else 4L * 60L * 60L * 1000L
            lock.acquire(Math.max(ms, 30_000L))
            wakeLock = lock
        } catch (_: Exception) {
        }
    }

    private fun releaseWakeLock() {
        try {
            wakeLock?.let { if (it.isHeld) it.release() }
        } catch (_: Exception) {
        }
        wakeLock = null
    }

    private fun formatTime(sec: Int): String {
        val safe = Math.max(0, sec)
        val h = safe / 3600
        val m = (safe % 3600) / 60
        val s = safe % 60
        return if (h > 0) String.format("%02d:%02d:%02d", h, m, s) else String.format("%02d:%02d", m, s)
    }

    private fun buildNotification(): Notification {
        val typeLabel = when (sessionType) {
            "pomodoro_focus" -> "Pomodoro Focus"
            "short_break" -> "Short Break"
            "long_break" -> "Long Break"
            "stopwatch" -> "Open Focus"
            else -> "Focus Block"
        }
        val time = formatTime(remainingOrElapsed())
        val status = when {
            isPaused -> "Paused · $time"
            totalSeconds > 0 -> "$time remaining"
            else -> "$time focused"
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("FocusMate · $typeLabel")
            .setContentText(status)
            .setSmallIcon(R.drawable.ic_stat_focus)
            .setOngoing(true)
            .setContentIntent(appPendingIntent())
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build()
    }

    private fun updateNotification() {
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .notify(NOTIFICATION_ID, buildNotification())
    }

    private fun appPendingIntent(): PendingIntent {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        return PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        releaseWakeLock()
        isRunning = false
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
