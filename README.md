# FocusMate

Offline-first Android focus app (React Native + Expo, native Kotlin, SQLite). Focus timer, Pomodoro,
real app blocking via an AccessibilityService, analytics, themes. No account, no backend.

## What works (and how it was verified)
| Area | Status | Verified by |
|---|---|---|
| Focus timer: start / pause / resume / end, survives app kill & reboot | Implemented | 14 automated tests on real SQLite with a fake clock |
| Pomodoro auto-cycle (focus → short/long breaks), custom lengths | Implemented | same tests |
| Analytics (7/30/90d, streaks, hours, types) from SQLite sessions | Implemented | same tests |
| Settings: theme light/dark/system, daily goal, Pomodoro, alerts, strict mode | Implemented | type-check + bundle; **not yet tapped through on a device** |
| Installed-app picker, search, permission management | Implemented | type-check + bundle; **needs device** |
| App blocking (AccessibilityService → HOME + block screen) | Implemented | Kotlin type-checked vs. real API 36 `android.jar`; **needs device** |
| Website blocking (local DNS filter via VpnService, opt-in, experimental) | Implemented | Packet logic executed on a JVM (29 checks); service type-checked; **needs device** |

## Build an APK
See **INSTALL_ON_PHONE.md** (cloud build via GitHub Actions, or `./build-apk.sh` locally). Manual route:
```bash
npm install
cd android && ./gradlew assembleRelease     # app/build/outputs/apk/release/app-release.apk
```
Install: `adb install -r app/build/outputs/apk/release/app-release.apk`.
**Release signing:** `android/app/build.gradle` signs release builds with the *debug* keystore. Fine for
sideloading/testing; create your own keystore before any store release.

## Tests
```bash
npm run typecheck      # TypeScript
npm test               # engine + SQL tests (Node 22+, uses node:sqlite)
npm run test:kotlin    # type-checks Kotlin vs android.jar API 36 (RN/AndroidX stubbed; not a real build) + runs DNS packet tests on a JVM
```

## Android 16 notes
Targets API 36: edge-to-edge is handled with safe-area insets; predictive back is handled in the block
screen; the foreground service declares `specialUse`; broad `QUERY_ALL_PACKAGES` was replaced by a
launcher `<queries>` intent. On tablets/foldables Android 16 ignores `screenOrientation` locks.

## Device test checklist (do this on a real phone)
1. Guard → enable Accessibility (if greyed out: App info → ⋮ → *Allow restricted settings*). Select an app.
2. Focus → 15 min → Start. Open the selected app: it should be sent Home and the block screen should show.
3. Set Pomodoro Focus to 5 min and Short break to 1 min in Settings, start a Pomodoro, lock the screen through the first block: expect a vibration + notification, and the next phase running when you unlock.
4. Force-stop FocusMate mid-session, reopen: the session should resume with the correct time.
5. Guard → turn on *Block websites while focusing*, accept the VPN prompt, add `reddit.com`, start a focus block, open it in a browser: it should fail to load. Turn off the browser's "Secure DNS" and Android "Private DNS" first or it will not apply.
6. Settings → Light / System theme; check status/nav bars on a gesture-nav phone.

## Behaviour worth knowing
- Home launcher, dialer, Settings and System UI can never be blocked (no lock-outs).
- Blocking self-expires at the end of the phase even if the app is dead (and after 12 h for open-ended sessions).
- Ending a countdown early keeps the focused time as "Ended early"; taps under 10 s are discarded.
- If the app has been away longer than ~1 min after a Pomodoro phase ended, the next phase starts *now* rather than inventing history.
- Strict mode is a commitment aid, not security: it can't stop uninstalling or disabling the service.
