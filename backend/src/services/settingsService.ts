import dbConfig from '../config/dbConfig';

type SystemSettings = any;

const GLOBAL_KEY = 'global';

export async function getGlobalSettings(): Promise<SystemSettings | null> {
  const db = dbConfig.getConnection();
  const row = await db.get('SELECT settings FROM system_settings WHERE userId = ?', GLOBAL_KEY);
  return row ? JSON.parse(row.settings) : null;
}

export async function setGlobalSettings(s: SystemSettings): Promise<void> {
  const db = dbConfig.getConnection();
  const settingsStr = JSON.stringify(s);
  const now = new Date().toISOString();
    await db.run(
      `REPLACE INTO system_settings (userId, settings, updatedAt)
       VALUES (@p0, @p1, @p2);`,
      [GLOBAL_KEY, settingsStr, now]
    );
}

export async function getUserSettings(userId: string): Promise<SystemSettings | null> {
  const db = dbConfig.getConnection();
  const row = await db.get('SELECT settings FROM system_settings WHERE userId = ?', userId);
  return row ? JSON.parse(row.settings) : null;
}

export async function setUserSettings(userId: string, s: SystemSettings): Promise<void> {
  const db = dbConfig.getConnection();
  const settingsStr = JSON.stringify(s);
  const now = new Date().toISOString();
    await db.run(
      `REPLACE INTO system_settings (userId, settings, updatedAt)
       VALUES (@p0, @p1, @p2);`,
      [userId, settingsStr, now]
    );
}

export async function getEffectiveSettings(userId?: string): Promise<SystemSettings | null> {
  console.log(`[SettingsService] getEffectiveSettings called for userId: ${userId}`);
  const globalSettings = (await getGlobalSettings()) || {};
  const userSettings = userId ? ((await getUserSettings(userId)) || {}) : {};
  console.log(`[SettingsService] Global settings keys: ${Object.keys(globalSettings).join(',')}`);
  console.log(`[SettingsService] User settings keys: ${Object.keys(userSettings).join(',')}`);
  
  // Use simple deep merge logic to prevent shallow merge overwriting
  // A utility function for deep merge
  const deepMerge = (target: any, source: any) => {
    for (const key of Object.keys(source)) {
      if (source[key] instanceof Object && key in target) {
        Object.assign(source[key], deepMerge(target[key], source[key]))
      }
    }
    Object.assign(target || {}, source)
    return target
  }
  
  // Start with empty object, merge global, then user
  // However, simple spread is: { ...global, ...user }
  // If global has { theme: { mode: 'dark' } } and user has { theme: { primaryColor: 'red' } }
  // spread will result in user's theme overwriting global's theme completely, losing mode: 'dark'.
  // So we need deep merge here too.
  
  const merged = JSON.parse(JSON.stringify(globalSettings)); // clone
  
  const mergeRecursive = (obj1: any, obj2: any) => {
    for (const p in obj2) {
      try {
        if (obj2[p].constructor === Object) {
          obj1[p] = mergeRecursive(obj1[p] || {}, obj2[p]);
        } else {
          obj1[p] = obj2[p];
        }
      } catch (e) {
        obj1[p] = obj2[p];
      }
    }
    return obj1;
  };
  
  return mergeRecursive(merged, userSettings);
}
