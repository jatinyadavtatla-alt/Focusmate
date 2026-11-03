# FocusMate

FocusMate is a private productivity workspace built in this repository with Next.js, TypeScript, Drizzle ORM, and PostgreSQL. It includes a timestamp-based focus timer, Pomodoro cycles, a stopwatch, session history, analytics derived from saved sessions, theme and timer preferences, and saved distraction lists.

## Important platform note

This repository was provided as a Next.js/PostgreSQL project, not as an Expo or Android Studio project. The application here is a responsive web app. It is **not an Android APK**, and the browser cannot query installed Android packages, monitor foreground apps, run an Android `AccessibilityService`, start a `VpnService`, or guarantee background execution after the browser process is killed.

Focus Guard app and domain selections are persisted as planning lists only. They are deliberately labelled as unenforced in the UI. Strict Mode adds a confirmation before ending a session that was started in strict mode; it cannot prevent closing the browser, uninstalling an app, or force-stop behavior. Do not use this web build as a substitute for native Android app blocking.

A real Android 13+ release needs a separate Expo development-build/Android Studio project, Kotlin native service declarations and modules, Android permissions, device testing, and an APK/AAB build. No such Android source or binary is included in this Next.js workspace, so there are no truthful APK build commands for this project yet.

## Implemented in this workspace

- Dark, light, and system themes, stored in PostgreSQL.
- Focus countdown (30 minutes by default), adjustable duration, Pomodoro, and stopwatch modes.
- Session start/pause/resume/finish/cancel persisted through server routes.
- Timer display derived from stored timestamps and accumulated elapsed seconds; a one-second interval only refreshes the display. The active session is restored from the database after a page reload.
- Automatic Pomodoro focus/break transitions while the page is running.
- Completion browser notification (permission requested only from Settings), optional generated chime, optional browser vibration, and a best-effort Screen Wake Lock.
- Strict-mode confirmation for early exit; it is a commitment prompt, not device-level enforcement.
- Daily/weekly/monthly totals, session count, average session length, current streak, and charts computed from saved sessions (no sample analytics).
- PostgreSQL-backed app/domain planning lists and Pomodoro/user preferences.
- Responsive phone and desktop layouts.

## Run locally

Prerequisites: Node.js 20+, npm, and PostgreSQL. `DATABASE_URL` must point at a database the current user can access; in this environment it is supplied in `.env`.

```bash
npm install
npx drizzle-kit push
npm run dev
```

Open <http://localhost:3000>. The development server is the Next.js server; the timer data API and PostgreSQL connection are part of the same app. Do not commit `.env` or database credentials.

Useful checks:

```bash
npx next typegen
npm exec tsc -- --noEmit --pretty false
npm run build
```

The schema is defined in `src/db/schema.ts`. `drizzle-kit push` applies it directly to the configured PostgreSQL database. The APIs are under `src/app/api/`:

- `GET /api/state` — current settings, Pomodoro config, sessions, and saved lists.
- `POST /api/sessions` — start a session.
- `PATCH /api/sessions/:id` — pause, resume, finish, or cancel a session.
- `GET/PUT /api/settings` — user and Pomodoro settings.
- `GET/PUT /api/blocked-apps` — saved app planning list.
- `GET/POST/DELETE /api/websites` — saved website planning list.
- `GET /api/health` — database health check.

## Manual test checklist

1. Open Overview and start the 30-minute focus session.
2. Confirm the timer is active and that navigation shows the running state.
3. Pause, wait a few seconds, and resume; paused time should not be added.
4. Reload the page while a session is active; it should restore with the correct remaining time.
5. Use Finish now to complete a countdown session; verify it appears in Recent sessions and Insights.
6. Start a stopwatch; confirm elapsed time is derived from timestamps and stop it to save an early-ended history record.
7. Select Pomodoro, change the durations in Settings to short test values, and verify focus/break transitions and saved session records.
8. Enable Strict mode, start a new session, choose End session, and confirm that the commitment dialog appears before cancellation.
9. Change themes and daily goal; reload and verify the preferences remain saved.
10. Add/remove a distraction app and website domain; reload and verify the planning lists remain saved. Remember: these are **not enforced** in this web build.
11. Grant browser notifications in Settings and verify the permission is reflected in the page. Behavior while the browser/device is asleep depends on the browser and OS.

## Known limitations

- This project uses PostgreSQL because that is the database wired into the supplied full-stack environment. It does not use SQLite or Expo SecureStore/SQLite.
- Browser storage and server connectivity are required to create/update server-backed sessions; the app is not an offline-first Android package.
- Browser timers can calculate elapsed time correctly when resumed, but a browser cannot promise that JavaScript, notifications, or Pomodoro transitions run at the exact instant while the browser is suspended or the device is powered off.
- The focus guard does not enforce app or website blocks. App names are a small curated planning list, not installed-app discovery.
- Website rules do not intercept DNS or HTTPS traffic. No VPN permission is requested and no browsing contents are inspected.
- Friends/groups, YouTube study mode, and ambient audio assets are not implemented.
- No Android 16 physical-device test or signed APK build has been performed from this web-only repository.
