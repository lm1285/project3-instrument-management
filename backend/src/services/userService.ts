import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

type UserRecord = {
  id: string;
  username: string;
  role: string;
  roles?: string[];
  password_hash: string;
  password_salt: string;
  password_plain?: string;
  permissions?: string[];
  created_at: string;
  is_system_admin?: boolean;
  name?: string;
  department?: string;
};

type UsersFile = {
  users: UserRecord[];
};

const dataDir = path.resolve(__dirname, '../../data');
const filePath = path.join(dataDir, 'users.json');
const LEGACY_ADMIN_ROLE = '管理员';

const SHADOW_KNIFE_PERMISSIONS = [
  'shadow_knife:task:view',
  'shadow_knife:task:add',
  'shadow_knife:task:edit',
  'shadow_knife:task:delete',
  'shadow_knife:rule:view',
  'shadow_knife:rule:add',
  'shadow_knife:rule:edit',
  'shadow_knife:rule:delete',
  'shadow_knife:rule:import',
];

const DEFAULT_ADMIN_PERMISSIONS = [
  'dashboard:alert:view',
  'dashboard:alert:process',
  'dashboard:alert:delete',
  'dashboard:schedule:view',
  'dashboard:schedule:edit',
  'dashboard:schedule:insert_row',
  'dashboard:schedule:delete_row',
  'dashboard:schedule:merge',
  'dashboard:schedule:split',
  'dashboard:schedule:clear',
  'dashboard:schedule:undo',
  'flow:view',
  'flow:search',
  'flow:borrow',
  'flow:checkout',
  'flow:checkout:force',
  'flow:checkin',
  'flow:reserve',
  'flow:delete',
  'instrument:view',
  'instrument:search',
  'instrument:add',
  'instrument:edit',
  'instrument:delete',
  'instrument:view_sensitive',
  'instrument:import',
  'instrument:export',
  'instrument:merge',
  'instrument:unmerge',
  'instrument:organize',
  'instrument:print_qr',
  'instrument:scan',
  'instrument:history',
  ...SHADOW_KNIFE_PERMISSIONS,
  'stats:instrument:view',
  'stats:instrument:save_view',
  'stats:usage:view',
  'stats:usage:search',
  'stats:usage:edit',
  'stats:usage:delete',
  'stats:usage:export',
  'stats:alert:view',
  'stats:maintenance:view',
  'system:role:view',
  'system:role:edit',
  'system:role:reset',
  'system:user:view',
  'system:user:add',
  'system:user:edit',
  'system:user:perm',
  'system:user:delete',
  'system:config:view',
  'system:config:edit',
  'system:template:view',
  'system:template:add',
  'system:template:edit',
  'system:template:delete',
  'system:template:download',
  'system:backup:view',
  'system:backup:strategy',
  'system:backup:create',
  'system:backup:restore',
  'system:backup:delete',
  'system:maintenance:view',
  'system:maintenance:edit',
  'system:maintenance:clean_cache',
  'system:maintenance:analyze_index',
  'system:audit:view',
  'system:audit:export',
  'system:audit:clean',
];

const PERMISSION_MIGRATION_MAP: Record<string, string> = {
  'mgmt:view': 'instrument:view',
  'mgmt:search': 'instrument:search',
  'mgmt:add': 'instrument:add',
  'mgmt:merge_group': 'instrument:merge',
  'mgmt:smart_organize': 'instrument:organize',
  'mgmt:import': 'instrument:import',
  'mgmt:export': 'instrument:export',
  'mgmt:edit': 'instrument:edit',
  'mgmt:delete': 'instrument:delete',
  'mgmt:history': 'instrument:history',
  'mgmt:remove_merge': 'instrument:unmerge',
  'mgmt:scan': 'instrument:scan',
  'settings:users:view': 'system:user:view',
  'settings:users:add': 'system:user:add',
  'settings:users:edit': 'system:user:edit',
  'settings:users:perm': 'system:user:perm',
  'settings:users:delete': 'system:user:delete',
  'settings:system:view': 'system:config:view',
  'settings:backup:view': 'system:backup:view',
  'settings:maintenance:view': 'system:maintenance:view',
  'settings:users': 'system:user',
  'settings:system': 'system:config',
  'settings:backup': 'system:backup',
  'settings:maintenance': 'system:maintenance',
  mgmt: 'instrument',
  settings: 'system',
  'statistics:export': 'stats:usage:export',
  'rpa:view': 'shadow_knife:task:view',
  rpa: 'shadow_knife:rule:view',
};

function saveFile(data: UsersFile) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function genId() {
  return crypto.randomUUID();
}

function hashPassword(password: string, salt?: string) {
  const resolvedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, resolvedSalt, 100000, 32, 'sha256').toString('hex');
  return { hash, salt: resolvedSalt };
}

function isAdminUser(user: Pick<UserRecord, 'role' | 'is_system_admin' | 'username'>) {
  return user.role === 'admin' || user.role === LEGACY_ADMIN_ROLE || user.is_system_admin || user.username === 'admin';
}

function normalizePermissions(permissions?: string[]) {
  return [...new Set((permissions || []).filter(Boolean))];
}

function ensureFile(): UsersFile {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  let data: UsersFile = { users: [] };
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    try {
      data = JSON.parse(raw) as UsersFile;
    } catch {
      data = { users: [] };
    }
  }

  let migrationChanged = false;

  data.users.forEach((user) => {
    const migratedPermissions = normalizePermissions(
      (user.permissions || []).map((permission) => PERMISSION_MIGRATION_MAP[permission] || permission),
    );

    if (JSON.stringify(migratedPermissions) !== JSON.stringify(user.permissions || [])) {
      user.permissions = migratedPermissions;
      migrationChanged = true;
    }

    if (isAdminUser(user)) {
      const adminPermissions = normalizePermissions([
        ...(user.permissions || []),
        ...SHADOW_KNIFE_PERMISSIONS,
      ]);

      if (JSON.stringify(adminPermissions) !== JSON.stringify(user.permissions || [])) {
        user.permissions = adminPermissions;
        migrationChanged = true;
      }
    }
  });

  let systemAdmin = data.users.find((user) => user.is_system_admin === true);

  if (!systemAdmin) {
    const legacyAdmin = data.users.find((user) => user.username === 'admin');
    if (legacyAdmin) {
      legacyAdmin.is_system_admin = true;
      systemAdmin = legacyAdmin;
      migrationChanged = true;
    } else {
      const { hash, salt } = hashPassword('admin123');
      const newAdmin: UserRecord = {
        id: genId(),
        username: 'admin',
        role: LEGACY_ADMIN_ROLE,
        roles: [LEGACY_ADMIN_ROLE],
        password_hash: hash,
        password_salt: salt,
        password_plain: 'admin123',
        created_at: new Date().toISOString(),
        is_system_admin: true,
        permissions: [...DEFAULT_ADMIN_PERMISSIONS],
        department: '',
      };
      data.users.push(newAdmin);
      systemAdmin = newAdmin;
      migrationChanged = true;
    }
  }

  if (migrationChanged) {
    saveFile(data);
  }

  return data;
}

export function createUser(username: string, password: string, role: string, name?: string, department?: string): UserRecord {
  const data = ensureFile();
  if (data.users.find((user) => user.username === username)) {
    throw new Error('用户名已存在');
  }

  const { hash, salt } = hashPassword(password);
  const record: UserRecord = {
    id: genId(),
    username,
    role,
    roles: [role],
    password_hash: hash,
    password_salt: salt,
    password_plain: password,
    created_at: new Date().toISOString(),
    name,
    department: department?.trim() || '',
  };

  data.users.push(record);
  saveFile(data);
  return record;
}

export function listUsers(): Omit<UserRecord, 'password_hash' | 'password_salt'>[] {
  const data = ensureFile();
  return data.users.map(({ password_hash, password_salt, ...rest }) => rest);
}

export function getUserByUsername(username: string): UserRecord | null {
  const data = ensureFile();
  return data.users.find((user) => user.username === username) || null;
}

export function verifyCredentials(username: string, password: string): Omit<UserRecord, 'password_hash' | 'password_salt'> | null {
  const user = getUserByUsername(username);
  if (!user) {
    return null;
  }

  const calc = hashPassword(password, user.password_salt);
  if (!crypto.timingSafeEqual(Buffer.from(calc.hash), Buffer.from(user.password_hash))) {
    return null;
  }

  const { password_hash, password_salt, ...rest } = user;
  return rest;
}

export function updateUser(
  id: string,
  updates: Partial<{
    username: string;
    role: string;
    roles: string[];
    password: string;
    permissions: string[];
    name: string;
    department: string;
  }>,
) {
  const data = ensureFile();
  const index = data.users.findIndex((user) => user.id === id);
  if (index === -1) {
    throw new Error('用户不存在');
  }

  const current = data.users[index];

  if (updates.username) current.username = updates.username;
  if (updates.name !== undefined) current.name = updates.name;
  if (updates.department !== undefined) current.department = updates.department.trim();

  if (updates.role) {
    current.role = updates.role;
    if (!updates.roles) {
      current.roles = [updates.role];
    }
  }

  if (updates.roles) current.roles = updates.roles;
  if (updates.permissions) current.permissions = normalizePermissions(updates.permissions);

  if (updates.password) {
    const { hash, salt } = hashPassword(updates.password);
    current.password_hash = hash;
    current.password_salt = salt;
    current.password_plain = updates.password;
  }

  data.users[index] = current;
  saveFile(data);

  const { password_hash, password_salt, ...rest } = current;
  return rest;
}

export function deleteUser(id: string): boolean {
  const data = ensureFile();
  const userToDelete = data.users.find((user) => user.id === id);

  if (userToDelete && (userToDelete.is_system_admin || userToDelete.username === 'admin')) {
    throw new Error('无法删除管理员账户');
  }

  const before = data.users.length;
  data.users = data.users.filter((user) => user.id !== id);
  saveFile(data);
  return data.users.length < before;
}
