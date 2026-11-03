# Get FocusMate onto your phone

You need an APK. Pick ONE way to build it.

## Option A — Build in the cloud (no Android tools needed)
1. Create a free GitHub account and a new **private** repository.
2. Upload this project folder's contents (`.gitignore` keeps `node_modules` out).
3. Open the repo's **Actions** tab → **Build Android APK** → **Run workflow**.
4. When it turns green (about 15–25 min), open the run and download the **focusmate-apk** artifact (a zip containing `app-release.apk`).
5. If it fails, open the failed step, copy the last ~30 lines of the log, and send them to me.

## Option B — Build on your computer
Install JDK 17+, Node 20+, and Android Studio (for the SDK), set `ANDROID_HOME`, then:
```bash
./build-apk.sh              # APK: android/app/build/outputs/apk/release/app-release.apk
./build-apk.sh --install    # also installs to a USB-connected phone (USB debugging on)
```

## Installing the APK
1. Copy `app-release.apk` to the phone (USB, Drive, email to yourself).
2. Open it; if asked, allow "Install unknown apps" for the app you opened it from.
3. Open FocusMate → **Guard** tab and enable permissions in this order:
   - **Accessibility service.** If the toggle is greyed out ("Restricted setting"): long-press the FocusMate icon → App info → ⋮ menu → **Allow restricted settings**, then retry.
   - **Notifications**, then **Display over other apps**, then **Unrestricted battery**.
4. Pick apps to block, start a 5-minute focus block from **Focus**, open a selected app to test it.
5. Optional: turn on **Block websites while focusing** and accept the VPN prompt.

## Signing
Builds are signed with the Android *debug* key. That is fine for installing on your own phone. Updates install over the top as long as you keep using the same key. For a Play Store release you must create your own keystore first.

## If something doesn't work
Tell me exactly what happened (e.g. "opened Instagram during a focus block and nothing blocked", "crashed on opening", the build log tail) plus your phone model and Android version, and I'll fix it.
