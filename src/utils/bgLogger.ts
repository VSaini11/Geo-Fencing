import AsyncStorage from '@react-native-async-storage/async-storage';

const BG_LOG_KEY = 'geo-checkin:bg_logs';
const MAX_LOGS = 200; // Keep last 200 entries to avoid storage bloat

export interface BgLogEntry {
  ts: number;       // timestamp
  time: string;     // human-readable time
  msg: string;      // log message
  level: 'info' | 'warn' | 'error';
}

/**
 * Persistent background logger.
 * Writes logs to AsyncStorage so they survive app kill.
 * Use this instead of console.log in background tasks.
 */
async function writeLog(msg: string, level: BgLogEntry['level'] = 'info') {
  try {
    // Also console.log so it shows in Metro/Logcat when available
    const prefix = `[BG ${level.toUpperCase()}]`;
    if (level === 'error') {
      console.error(prefix, msg);
    } else {
      console.log(prefix, msg);
    }

    const now = Date.now();
    const entry: BgLogEntry = {
      ts: now,
      time: new Date(now).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      msg,
      level,
    };

    const raw = await AsyncStorage.getItem(BG_LOG_KEY);
    const logs: BgLogEntry[] = raw ? JSON.parse(raw) : [];
    logs.push(entry);

    // Trim to last MAX_LOGS entries
    if (logs.length > MAX_LOGS) {
      logs.splice(0, logs.length - MAX_LOGS);
    }

    await AsyncStorage.setItem(BG_LOG_KEY, JSON.stringify(logs));
  } catch (_) {
    // Silent fail — we can't do much if AsyncStorage itself fails
  }
}

export const bgLog = {
  info: (msg: string) => writeLog(msg, 'info'),
  warn: (msg: string) => writeLog(msg, 'warn'),
  error: (msg: string) => writeLog(msg, 'error'),
};

/**
 * Read all stored background logs.
 * Call this from your foreground app to display/debug.
 */
export async function getBgLogs(): Promise<BgLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(BG_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

/**
 * Clear all stored background logs.
 */
export async function clearBgLogs(): Promise<void> {
  await AsyncStorage.removeItem(BG_LOG_KEY);
}
