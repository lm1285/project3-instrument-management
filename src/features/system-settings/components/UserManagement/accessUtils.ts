import type { DataNode } from 'antd/es/tree';
import { User } from '../../../../types/common';
import { PERMISSION_TREE, getRoleTemplates } from '../../../../features/auth/constants/permissions';

export const ROLE_OPTIONS = [
  { value: 'admin', label: '管理员', color: 'red', description: '拥有全部权限，通常仅限系统管理员。' },
  { value: 'transfer_operator', label: '转送专员', color: 'geekblue', description: '仅可使用一键转送，包括处理任务、下载结果和维护转送模板。' },
  { value: 'shadow_knife_operator', label: '影刀专用', color: 'purple', description: '仅用于影刀联用模块，并且只显示当前用户所属科室的数据。' },
  { value: 'principal', label: '负责人', color: 'gold', description: '负责业务配置、模板和核心流程管理。' },
  { value: 'device_manager', label: '设备管理员', color: 'cyan', description: '负责设备维护、出入库和台账整理。' },
  { value: 'engineer', label: '工程师', color: 'blue', description: '以日常使用和基础操作为主。' },
  { value: 'viewer', label: '访客', color: 'green', description: '仅查看，适用于只读账号。' },
] as const;

export function getRoleMeta(role?: string) {
  return ROLE_OPTIONS.find((item) => item.value === role) || {
    value: role || 'unknown',
    label: role || '未设置',
    color: 'default',
    description: '',
  };
}

export function collectLeafPermissionKeys(nodes: DataNode[]): string[] {
  let keys: string[] = [];
  nodes.forEach((node) => {
    if (node.children && node.children.length > 0) {
      keys = [...keys, ...collectLeafPermissionKeys(node.children)];
    } else {
      keys.push(String(node.key));
    }
  });
  return keys;
}

export function flattenPermissionTree(
  nodes: DataNode[] = PERMISSION_TREE,
  parents: string[] = [],
): Array<{ key: string; title: string; path: string[]; isLeaf: boolean }> {
  return nodes.flatMap((node) => {
    const path = [...parents, String(node.title)];
    const children = node.children || [];
    const current = {
      key: String(node.key),
      title: String(node.title),
      path,
      isLeaf: children.length === 0,
    };

    if (children.length === 0) {
      return [current];
    }

    return [current, ...flattenPermissionTree(children, path)];
  });
}

export function expandPermissionKeys(permissionKeys: string[], nodes: DataNode[] = PERMISSION_TREE): string[] {
  const leaves = collectLeafPermissionKeys(nodes);
  const expanded = new Set<string>();

  leaves.forEach((leaf) => {
    if (permissionKeys.includes(leaf)) {
      expanded.add(leaf);
      return;
    }

    const parts = leaf.split(':');
    let current = '';
    for (let index = 0; index < parts.length - 1; index += 1) {
      current += `${index === 0 ? '' : ':'}${parts[index]}`;
      if (permissionKeys.includes(current)) {
        expanded.add(leaf);
        break;
      }
    }
  });

  return Array.from(expanded);
}

export function getTopLevelPermissionGroups(nodes: DataNode[] = PERMISSION_TREE) {
  return nodes.map((node) => ({
    key: String(node.key),
    title: String(node.title),
    leafKeys: collectLeafPermissionKeys([node]),
  }));
}

export function getUserPrimaryRole(user?: Partial<User> | null) {
  if (!user) {
    return 'engineer';
  }

  if (Array.isArray(user.roles) && user.roles.length > 0) {
    return user.roles[0];
  }

  return user.role || 'engineer';
}

export function getRoleTemplatePermissions(role?: string) {
  const templates = getRoleTemplates();
  return templates[role || 'engineer'] || [];
}

export function isCustomPermissionUser(user: Partial<User>) {
  if (!Array.isArray(user.permissions)) {
    return false;
  }

  const primaryRole = getUserPrimaryRole(user);
  const template = [...getRoleTemplatePermissions(primaryRole)].sort();
  const current = [...user.permissions].sort();

  if (template.length !== current.length) {
    return true;
  }

  return template.some((permission, index) => permission !== current[index]);
}
