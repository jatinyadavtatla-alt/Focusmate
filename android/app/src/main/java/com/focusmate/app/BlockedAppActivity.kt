package com.focusmate.app

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.util.TypedValue
import android.window.OnBackInvokedDispatcher
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class BlockedAppActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val prefs = getSharedPreferences(BlockPolicy.PREFS, Context.MODE_PRIVATE)
        val strictMode = prefs.getBoolean(BlockPolicy.KEY_STRICT, false)
        val blockedPkg = intent.getStringExtra("BLOCKED_PACKAGE") ?: ""
        val blockedLabel = resolveLabel(blockedPkg)
        val untilMs = prefs.getLong(BlockPolicy.KEY_UNTIL, 0L)
        val remainingMin = Math.max(0L, (untilMs - System.currentTimeMillis() + 59_999L) / 60_000L)
        val isOpenEnded = prefs.getInt("planned_seconds", 0) <= 0

        val rootLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#101512"))
            setPadding(dp(32), dp(32), dp(32), dp(32))
        }

        // Shield / Leaf Icon Circle
        val iconBadge = TextView(this).apply {
            text = "🛡️"
            textSize = 36f
            gravity = Gravity.CENTER
            val size = dp(80)
            layoutParams = LinearLayout.LayoutParams(size, size).apply {
                bottomMargin = dp(24)
            }
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#171F1B"))
                setStroke(dp(1), Color.parseColor("#C0ED8A"))
            }
        }
        rootLayout.addView(iconBadge)

        // Eyebrow
        val eyebrow = TextView(this).apply {
            text = if (strictMode) "STRICT FOCUS MODE ON" else "FOCUS BLOCK IN PROGRESS"
            textSize = 11f
            setTextColor(Color.parseColor("#C0ED8A"))
            letterSpacing = 0.15f
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = dp(12)
            }
        }
        rootLayout.addView(eyebrow)

        // Title
        val title = TextView(this).apply {
            text = if (blockedLabel.isNotEmpty()) "$blockedLabel is paused.\nStay in your flow." else "Take a breath.\nStay in your flow."
            textSize = 28f
            setTextColor(Color.parseColor("#EDF3ED"))
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = dp(16)
            }
        }
        rootLayout.addView(title)

        // Subtitle
        val subtitle = TextView(this).apply {
            text = when {
                isOpenEnded -> "You set aside this time for what matters. This app stays blocked until you end your focus session."
                remainingMin <= 1L -> "You set aside this time for what matters. Less than a minute left in your focus block."
                else -> "You set aside this time for what matters. About $remainingMin min left in your focus block."
            }
            textSize = 14f
            setTextColor(Color.parseColor("#8B998D"))
            gravity = Gravity.CENTER
            setLineSpacing(dp(4).toFloat(), 1.2f)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = dp(36)
            }
        }
        rootLayout.addView(subtitle)

        // Primary Action: Return to FocusMate
        val returnButton = Button(this).apply {
            text = "Return to FocusMate"
            setTextColor(Color.parseColor("#172016"))
            textSize = 14f
            isAllCaps = false
            background = GradientDrawable().apply {
                cornerRadius = dp(12).toFloat()
                setColor(Color.parseColor("#C0ED8A"))
            }
            setPadding(dp(24), dp(14), dp(24), dp(14))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(48)
            )
            setOnClickListener { returnToFocusMate() }
        }
        rootLayout.addView(returnButton)

        setContentView(rootLayout)

        // On Android 16 (target 36) the legacy onBackPressed() is no longer delivered, so also
        // register with the new dispatcher. Both paths do the same thing.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            onBackInvokedDispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT) {
                returnToFocusMate()
            }
        }
    }

    private fun resolveLabel(pkg: String): String {
        if (pkg.isEmpty()) return ""
        return try {
            packageManager.getApplicationLabel(packageManager.getApplicationInfo(pkg, 0)).toString()
        } catch (_: Exception) {
            ""
        }
    }

    private fun returnToFocusMate() {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName) ?: Intent(this, MainActivity::class.java)
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        startActivity(launchIntent)
        finish()
    }

    @Deprecated("Superseded by OnBackInvokedCallback on API 33+; kept for older Android versions.")
    override fun onBackPressed() {
        returnToFocusMate()
    }

    private fun dp(value: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value.toFloat(),
            resources.displayMetrics
        ).toInt()
    }
}

