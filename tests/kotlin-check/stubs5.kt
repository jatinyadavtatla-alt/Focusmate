package androidx.core.app
import android.app.Notification
import android.app.PendingIntent
import android.content.Context
class NotificationCompat {
  companion object { const val PRIORITY_DEFAULT = 0; const val CATEGORY_PROGRESS = "progress"; const val FOREGROUND_SERVICE_IMMEDIATE = 1 }
  class Builder(ctx: Context, channelId: String) {
    fun setContentTitle(t: CharSequence?): Builder = this
    fun setContentText(t: CharSequence?): Builder = this
    fun setSmallIcon(i: Int): Builder = this
    fun setPriority(p: Int): Builder = this
    fun setAutoCancel(b: Boolean): Builder = this
    fun setContentIntent(p: PendingIntent?): Builder = this
    fun setOngoing(b: Boolean): Builder = this
    fun setOnlyAlertOnce(b: Boolean): Builder = this
    fun setCategory(c: String?): Builder = this
    fun setForegroundServiceBehavior(b: Int): Builder = this
    fun build(): Notification = TODO()
  }
}
class NotificationManagerCompat { fun areNotificationsEnabled(): Boolean = true; companion object { fun from(c: Context) = NotificationManagerCompat() } }
