import { NativeModules, PermissionsAndroid, Platform } from "react-native";

export interface PermissionStatus {
  accessibility: boolean;
  usageStats: boolean;
  overlay: boolean;
  notifications: boolean;
  batteryOptimization: boolean;
}

export interface InstalledApp {
  packageName: string;
  appName: string;
  isSystem: boolean;
  /** Home launcher, dialer, Settings… never blockable, so the user can never lock themselves out. */
  isProtected: boolean;
  /** Base64 PNG, no data-URI prefix. */
  iconBase64: string | null;
}

const { FocusNativeModule } = NativeModules;

/** True only on an Android build that actually contains the Kotlin module. */
export const hasNativeFocus: boolean = Platform.OS === "android" && !!FocusNativeModule;

const noPermissions: PermissionStatus = {
  accessibility: false,
  usageStats: false,
  overlay: false,
  notifications: false,
  batteryOptimization: false,
};

function call(name: string, ...args: unknown[]) {
  if (hasNativeFocus && typeof FocusNativeModule[name] === "function") {
    try {
      FocusNativeModule[name](...args);
    } catch (e) {
      console.warn(`FocusNativeModule.${name} failed`, e);
    }
  }
}

export const NativeFocus = {
  checkPermissions: async (): Promise<PermissionStatus> => {
    if (!hasNativeFocus || !FocusNativeModule.checkPermissions) return noPermissions;
    try {
      return await FocusNativeModule.checkPermissions();
    } catch {
      return noPermissions;
    }
  },

  requestAccessibilityPermission: () => call("requestAccessibilityPermission"),
  requestUsageStatsPermission: () => call("requestUsageStatsPermission"),
  requestOverlayPermission: () => call("requestOverlayPermission"),
  requestBatteryOptimization: () => call("requestBatteryOptimization"),

  /** Android 13+ needs a runtime prompt; falls back to the system notification settings if blocked. */
  requestNotificationPermission: async () => {
    if (Platform.OS !== "android") return;
    if (Number(Platform.Version) >= 33) {
      const res = await PermissionsAndroid.request("android.permission.POST_NOTIFICATIONS" as any);
      if (res === PermissionsAndroid.RESULTS.GRANTED) return;
    }
    call("requestNotificationPermission");
  },

  getInstalledApps: async (): Promise<InstalledApp[]> => {
    if (!hasNativeFocus || !FocusNativeModule.getInstalledApps) return [];
    return await FocusNativeModule.getInstalledApps();
  },

  /**
   * @param isBlocking whether app blocking should be enforced right now
   * @param plannedSeconds phase length; pass 0 for open-ended or paused phases
   */
  syncSessionState: (
    isBlocking: boolean,
    strictMode: boolean,
    plannedSeconds: number,
    elapsedSeconds: number,
    sessionType: string
  ) => call("syncSessionState", isBlocking, strictMode, Math.round(plannedSeconds), Math.round(elapsedSeconds), sessionType),

  syncBlockedPackages: (packages: string[]) => call("syncBlockedPackages", packages),
  syncPreferences: (soundEnabled: boolean, vibrationEnabled: boolean) =>
    call("syncPreferences", soundEnabled, vibrationEnabled),

  /** Idempotent: (re)creates the foreground timer in the given state, running or paused. */
  startTimerService: (sessionType: string, totalSeconds: number, elapsedSeconds: number, paused = false) =>
    call("startTimerService", sessionType, Math.round(totalSeconds), Math.round(elapsedSeconds), paused),
  pauseTimerService: () => call("pauseTimerService"),
  resumeTimerService: () => call("resumeTimerService"),
  stopTimerService: () => call("stopTimerService"),

  /** Vibration/sound/notification for a finished phase. De-duplicated natively against the service. */
  notifyPhaseComplete: (sessionType: string) => call("notifyPhaseComplete", sessionType),

  // Website blocking (local DNS filter via VpnService)
  isVpnPrepared: async (): Promise<boolean> => {
    if (!hasNativeFocus || !FocusNativeModule.isVpnPrepared) return false;
    try {
      return await FocusNativeModule.isVpnPrepared();
    } catch {
      return false;
    }
  },
  requestVpnPermission: () => call("requestVpnPermission"),
  syncBlockedDomains: (domains: string[]) => call("syncBlockedDomains", domains),
  setWebsiteBlockingActive: (active: boolean) => call("setWebsiteBlockingActive", active),
};
