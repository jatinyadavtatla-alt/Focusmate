import assert from "node:assert/strict";
import * as db from "../src/db/sqlite";
import * as engine from "../src/engine/focusEngine";
import { normalizeDomain } from "../src/lib/domain";
import { buildAnalytics, buildDashboardStats, liveElapsed } from "../src/lib/stats";

let t = Date.now();
engine.setClock(() => t);
const adv = (sec: number) => { t += sec * 1000; };
const MIN = 60;
let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try { await fn(); passed++; console.log("  ok  -", name); }
  catch (e) { console.error("FAIL  -", name, "\n", e); process.exitCode = 1; }
}
async function reset() { // wipe sessions & run state between tests
  const d = await db.getDb();
  await d.runAsync("DELETE FROM focus_sessions");
  await d.runAsync("DELETE FROM app_state");
}
const pomo = { focusDuration: 25, shortBreakDuration: 5, longBreakDuration: 15, sessionsBeforeLongBreak: 4 };

(async () => {
  await test("fresh DB seeds default settings, pomodoro and blocked apps", async () => {
    const s = await db.fetchAllState();
    assert.equal(s.settings.dailyGoalMinutes, 180);
    assert.equal(s.pomodoro.focusDuration, 25);
    assert.equal(s.blockedApps.length, 6);
    assert.equal(s.sessions.length, 0);
  });

  await test("pause does not count paused time; resume continues; survives 'restart' (state only in DB)", async () => {
    await reset();
    let s = await engine.startMode("focus", 25, false, pomo);
    adv(10 * MIN);
    s = (await engine.pause(s))!;
    assert.equal(s.status, "paused");
    assert.equal(s.elapsedSeconds, 10 * MIN);
    adv(30 * MIN); // sits paused for 30 minutes
    const restored = (await db.getActiveSession())!; // a fresh launch reads from SQLite only
    assert.equal(liveElapsed(restored, t), 10 * MIN);
    const r = (await engine.resume(restored))!;
    adv(5 * MIN);
    assert.equal(liveElapsed(r, t), 15 * MIN);
  });

  await test("double start is refused (one active session at a time)", async () => {
    const a = await db.getActiveSession();
    const b = await engine.startMode("focus", 25, false, pomo);
    assert.equal(a!.id, b.id);
  });

  await test("session finishes in background: reconcile caps at planned time and ends at true end", async () => {
    await reset();
    const s = await engine.startMode("focus", 25, false, pomo);
    const start = t;
    adv(3 * 3600); // phone locked for 3h, app killed
    const { active, completed } = await engine.reconcile();
    assert.equal(active, null);
    assert.equal(completed.length, 1);
    assert.equal(completed[0].elapsedSeconds, 25 * MIN);
    assert.equal(completed[0].status, "completed");
    assert.equal(new Date(completed[0].endedAt!).getTime(), start + 25 * MIN * 1000);
    assert.equal(await db.getActiveSession(), null);
    assert.equal(s.id, completed[0].id);
  });

  await test("pomodoro: 4 focus blocks → 3 short breaks then a long break, then focus again, counter resets", async () => {
    await reset();
    await engine.startMode("pomodoro", 0, false, pomo);
    const seen: string[] = [];
    // advance exactly to each phase boundary, as the in-app tick would
    for (let i = 0; i < 9; i++) {
      const cur = (await db.getActiveSession())!;
      seen.push(cur.sessionType);
      adv(cur.plannedDurationSeconds!);
      await engine.reconcile();
    }
    assert.deepEqual(seen, ["pomodoro_focus","short_break","pomodoro_focus","short_break","pomodoro_focus","short_break","pomodoro_focus","long_break","pomodoro_focus"]);
    const run = await engine.loadRun();
    assert.equal(run.active, true);
    // counter reset to 0 after the long break, then the 9th phase (a focus block) completed → 1
    assert.equal(run.completedFocus, 1);
    const all = (await db.fetchAllState()).sessions.filter(x => x.status === "completed");
    assert.equal(all.length, 9);
    assert.ok(all.every(x => x.elapsedSeconds === x.plannedDurationSeconds));
  });

  await test("pomodoro: after a long absence the next phase starts now (no fabricated history)", async () => {
    await reset();
    await engine.startMode("pomodoro", 0, false, pomo);
    adv(2 * 3600);
    const { active, completed } = await engine.reconcile();
    assert.equal(completed.length, 1);
    assert.equal(active!.sessionType, "short_break");
    assert.equal(new Date(active!.startedAt).getTime(), t);
    assert.equal(liveElapsed(active!, t), 0);
  });

  await test("custom pomodoro lengths and long-break interval are honoured", async () => {
    await reset();
    const d = await db.getDb();
    await db.updatePomodoroSettings({ focusDuration: 1, shortBreakDuration: 1, longBreakDuration: 2, sessionsBeforeLongBreak: 2 });
    const p = await db.getPomodoroSettings();
    await engine.startMode("pomodoro", 0, false, p);
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) { const c = (await db.getActiveSession())!; seen.push(`${c.sessionType}:${c.plannedDurationSeconds}`); adv(c.plannedDurationSeconds!); await engine.reconcile(); }
    assert.deepEqual(seen, ["pomodoro_focus:60","short_break:60","pomodoro_focus:60","long_break:120"]);
    await db.updatePomodoroSettings({ focusDuration: 25, shortBreakDuration: 5, longBreakDuration: 15, sessionsBeforeLongBreak: 4 });
    void d;
  });

  await test("ending early keeps focused time as 'cancelled'; <10s taps are discarded; stopwatch ends 'completed'", async () => {
    await reset();
    let s = await engine.startMode("focus", 25, false, pomo);
    adv(5);
    let r = await engine.endByUser(s);
    assert.equal(r.finished, null);
    assert.equal((await db.fetchAllState()).sessions.length, 0);

    s = await engine.startMode("focus", 25, false, pomo);
    adv(7 * MIN);
    r = await engine.endByUser(s);
    assert.equal(r.finished!.status, "cancelled");
    assert.equal(r.finished!.elapsedSeconds, 7 * MIN);

    s = await engine.startMode("stopwatch", 0, false, pomo);
    adv(12 * MIN);
    r = await engine.endByUser(s);
    assert.equal(r.finished!.status, "completed");
    assert.equal(r.finished!.elapsedSeconds, 12 * MIN);
    assert.equal(await db.getActiveSession(), null);
  });

  await test("ending a pomodoro focus phase stops the whole run (no phantom breaks)", async () => {
    await reset();
    const s = await engine.startMode("pomodoro", 0, false, pomo);
    adv(10 * MIN);
    await engine.endByUser(s);
    assert.equal((await engine.loadRun()).active, false);
    assert.equal(await db.getActiveSession(), null);
  });

  await test("skipping a break jumps straight into the next focus phase", async () => {
    await reset();
    await engine.startMode("pomodoro", 0, false, pomo);
    adv(25 * MIN); await engine.reconcile();
    const br = (await db.getActiveSession())!;
    assert.equal(br.sessionType, "short_break");
    adv(60);
    const { next } = await engine.endByUser(br, { skipBreakToNext: true, pomodoro: pomo });
    assert.equal(next!.sessionType, "pomodoro_focus");
  });

  await test("paused sessions never auto-complete", async () => {
    await reset();
    const s = await engine.startMode("focus", 25, false, pomo);
    adv(20 * MIN); await engine.pause(s);
    adv(10 * 3600);
    const { active, completed } = await engine.reconcile();
    assert.equal(completed.length, 0);
    assert.equal(active!.status, "paused");
    assert.equal(active!.elapsedSeconds, 20 * MIN);
  });

  await test("stats: today, week, streak, analytics are computed from real rows", async () => {
    await reset();
    const d = await db.getDb();
    const settings = (await db.fetchAllState()).settings;
    const day = (n: number, hour: number) => { const x = new Date(t); x.setHours(hour, 0, 0, 0); x.setDate(x.getDate() - n); return x.toISOString(); };
    const ins = async (n: number, hour: number, secs: number, status: string, type = "focus") =>
      d.runAsync(`INSERT INTO focus_sessions (id, started_at, ended_at, segment_started_at, duration_seconds, planned_duration_seconds, session_type, status, completed, strict_mode, created_at) VALUES (?,?,?,NULL,?,?,?,?,?,0,?)`,
        `s${Math.random()}`, day(n, hour), day(n, hour), secs, secs, type, status, status === "completed" ? 1 : 0, day(n, hour));
    await ins(0, 9, 3600, "completed");
    await ins(0, 14, 1800, "cancelled");
    await ins(1, 10, 1500, "completed", "pomodoro_focus");
    await ins(2, 10, 900, "completed", "stopwatch");
    await ins(2, 11, 300, "completed", "short_break"); // breaks never count
    await ins(5, 10, 1200, "completed"); // gap at day 3,4 → streak stops at 3 days
    const st = (await db.fetchAllState());
    const dash = buildDashboardStats(st.sessions, st.settings, t);
    assert.equal(dash.todaySeconds, 5400);
    assert.equal(dash.streak, 3);
    assert.equal(dash.weekDays.length, 7);
    assert.equal(dash.weekSeconds, 5400 + 1500 + 900 + 1200);
    assert.equal(Math.round(dash.goalRatio), 50); // 90 of 180 min
    const an = buildAnalytics(st.sessions, settings, 7, t);
    assert.equal(an.totalSeconds, 5400 + 1500 + 900 + 1200);
    assert.equal(an.sessionCount, 5);
    assert.equal(an.completedCount, 4);
    assert.equal(an.endedEarlyCount, 1);
    assert.equal(an.longestSessionSeconds, 3600);
    assert.equal(an.byKind.pomodoro, 1500);
    assert.equal(an.byKind.stopwatch, 900);
    assert.equal(an.bestDay!.seconds, 5400);
    assert.equal(an.byHour[10], 1500 + 900 + 1200);
  });

  await test("blocked-app persistence: upsert, toggle, remove", async () => {
    await db.upsertBlockedApp({ packageName: "com.example.game", appName: "Game", isEnabled: true });
    await db.upsertBlockedApp({ packageName: "com.example.game", appName: "Game", isEnabled: false });
    let apps = (await db.fetchAllState()).blockedApps;
    assert.equal(apps.find(a => a.packageName === "com.example.game")!.isEnabled, false);
    await db.removeBlockedApp("com.example.game");
    apps = (await db.fetchAllState()).blockedApps;
    assert.equal(apps.some(a => a.packageName === "com.example.game"), false);
  });

  await test("normalizeDomain matches the Kotlin implementation's cases", async () => {
    assert.equal(normalizeDomain("https://www.YouTube.com/watch?v=1"), "youtube.com");
    assert.equal(normalizeDomain("old.reddit.com"), "old.reddit.com");
    assert.equal(normalizeDomain("example.com:8080/x"), "example.com");
    assert.equal(normalizeDomain("notadomain"), null);
    assert.equal(normalizeDomain("a b.com"), null);
    assert.equal(normalizeDomain("..com"), null);
  });

  console.log(`\n${passed} tests passed${process.exitCode ? " — WITH FAILURES" : ""}`);
})();
