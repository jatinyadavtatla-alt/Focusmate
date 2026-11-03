#!/usr/bin/env bash
# Type-checks the app's Kotlin against a real Android API 36 android.jar, with tiny hand-written stubs for
# React Native / AndroidX (whose AARs live on Maven). It is a fast sanity check, NOT a substitute for
# `./gradlew assembleRelease`. Needs network access to github.com and a JDK.
set -e
cd "$(dirname "$0")"
WORK=${WORK:-/tmp/focusmate-kt}; mkdir -p "$WORK"
[ -f "$WORK/android36.jar" ] || curl -sL -o "$WORK/android36.jar" https://github.com/Reginer/aosp-android-jar/raw/main/android-36/android.jar
if [ ! -x "$WORK/kotlinc/bin/kotlinc" ]; then
  curl -sL -o "$WORK/kotlin.zip" https://github.com/JetBrains/kotlin/releases/download/v2.1.21/kotlin-compiler-2.1.21.zip
  unzip -q -o "$WORK/kotlin.zip" -d "$WORK"
fi
SRC=../../android/app/src/main/java/com/focusmate/app
"$WORK/kotlinc/bin/kotlinc" -jvm-target 17 -classpath "$WORK/android36.jar" -d "$WORK/out" \
  stubs*.kt $SRC/DnsFilter.kt $SRC/FocusVpnService.kt $SRC/BlockPolicy.kt $SRC/CompletionCue.kt $SRC/FocusAccessibilityService.kt \
  $SRC/FocusTimerService.kt $SRC/BlockedAppActivity.kt $SRC/FocusNativeModule.kt $SRC/FocusPackage.kt
echo "Kotlin type-check passed"

# Real execution (not just type-checking) of the pure DNS packet logic on a JVM.
"$WORK/kotlinc/bin/kotlinc" -jvm-target 17 DnsFilterTest.kt "$SRC/DnsFilter.kt" -include-runtime -d "$WORK/dnstest.jar" 2>/dev/null
java -jar "$WORK/dnstest.jar"
