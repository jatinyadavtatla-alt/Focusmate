#!/usr/bin/env bash
# One-command APK build. Needs: Node 20+, JDK 17+, and the Android SDK (ANDROID_HOME or ANDROID_SDK_ROOT).
# Usage: ./build-apk.sh            build only
#        ./build-apk.sh --install  build, then `adb install -r` to a connected phone (USB debugging on)
set -euo pipefail
cd "$(dirname "$0")"

fail() { echo "ERROR: $1" >&2; exit 1; }

command -v node >/dev/null || fail "Node.js not found (need 20+)."
command -v java >/dev/null || fail "Java not found (need JDK 17+)."
JV=$(java -version 2>&1 | head -1 | sed -E 's/.*"([0-9]+)[."].*/\1/')
[ "${JV:-0}" -ge 17 ] || fail "JDK 17+ required, found $JV."

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
[ -n "$SDK" ] && [ -d "$SDK" ] || fail "Set ANDROID_HOME to your Android SDK folder (Android Studio: Settings > Android SDK)."
echo "sdk.dir=$SDK" > android/local.properties

echo "==> Installing JS dependencies"
npm ci --no-audit --no-fund

echo "==> Building release APK (first run downloads Gradle + SDK parts; can take 10+ min)"
chmod +x android/gradlew
( cd android && ./gradlew assembleRelease --no-daemon )

APK="android/app/build/outputs/apk/release/app-release.apk"
[ -f "$APK" ] || fail "Build finished but $APK was not found."
echo "==> APK ready: $APK ($(du -h "$APK" | cut -f1))"

if [ "${1:-}" = "--install" ]; then
  command -v adb >/dev/null || fail "adb not found; copy the APK to your phone manually."
  adb install -r "$APK"
  echo "==> Installed. Open FocusMate on your phone."
fi
