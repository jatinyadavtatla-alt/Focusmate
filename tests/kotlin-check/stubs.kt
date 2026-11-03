package com.facebook.react.bridge
import android.content.Context
import android.content.ContextWrapper
interface Promise { fun resolve(value: Any?); fun reject(code: String, message: String?, e: Throwable?) }
annotation class ReactMethod
interface ReadableMap
interface ReadableArray { fun size(): Int; fun getString(index: Int): String? }
interface WritableMap : ReadableMap { fun putBoolean(k: String, v: Boolean); fun putString(k: String, v: String?) }
interface WritableArray { fun pushMap(m: ReadableMap?) }
object Arguments { fun createMap(): WritableMap = TODO(); fun createArray(): WritableArray = TODO() }
open class ReactApplicationContext(base: Context) : ContextWrapper(base)
abstract class ReactContextBaseJavaModule(ctx: ReactApplicationContext) : NativeModule { abstract fun getName(): String }
