import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const focusSessions = pgTable("focus_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  startedAt: timestamp("start_time", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("end_time", { withTimezone: true }),
  segmentStartedAt: timestamp("segment_started_at", { withTimezone: true }),
  elapsedSeconds: integer("duration_seconds").notNull().default(0),
  plannedDurationSeconds: integer("planned_duration_seconds"),
  sessionType: text("session_type").notNull().default("focus"),
  status: text("status").notNull().default("active"),
  completed: boolean("completed").notNull().default(false),
  strictMode: boolean("strict_mode").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userSettings = pgTable("user_settings", {
  id: integer("id").primaryKey().default(1),
  theme: text("theme").notNull().default("dark"),
  dailyGoalMinutes: integer("daily_goal_minutes").notNull().default(180),
  soundEnabled: boolean("sound_enabled").notNull().default(false),
  vibrationEnabled: boolean("vibration_enabled").notNull().default(true),
  strictModeEnabled: boolean("strict_mode_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pomodoroSettings = pgTable("pomodoro_settings", {
  id: integer("id").primaryKey().default(1),
  focusDuration: integer("focus_duration").notNull().default(25),
  shortBreakDuration: integer("short_break_duration").notNull().default(5),
  longBreakDuration: integer("long_break_duration").notNull().default(15),
  sessionsBeforeLongBreak: integer("sessions_before_long_break").notNull().default(4),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const blockedApps = pgTable("blocked_apps", {
  id: serial("id").primaryKey(),
  packageName: text("package_name").notNull().unique(),
  appName: text("app_name").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
});

export const websiteRules = pgTable("website_rules", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull().unique(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
