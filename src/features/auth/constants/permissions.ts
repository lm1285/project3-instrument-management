import type { DataNode } from 'antd/es/tree';

export const PERMISSION_TREE: DataNode[] = [
  {
    title: '预警总览',
    key: 'dashboard:alert',
    children: [
      { title: '显示页面', key: 'dashboard:alert:view' },
      { title: '处理预警按钮', key: 'dashboard:alert:process' },
      { title: '删除预警按钮', key: 'dashboard:alert:delete' },
    ],
  },
  {
    title: '下场安排',
    key: 'dashboard:schedule',
    children: [
      { title: '显示页面', key: 'dashboard:schedule:view' },
      { title: '编辑单元格', key: 'dashboard:schedule:edit' },
      { title: '插入行按钮', key: 'dashboard:schedule:insert_row' },
      { title: '删除行按钮', key: 'dashboard:schedule:delete_row' },
      { title: '合并单元格按钮', key: 'dashboard:schedule:merge' },
      { title: '拆分单元格按钮', key: 'dashboard:schedule:split' },
      { title: '清空表格按钮', key: 'dashboard:schedule:clear' },
      { title: '撤回按钮', key: 'dashboard:schedule:undo' },
    ],
  },
  {
    title: '仪器出入',
    key: 'flow',
    children: [
      { title: '显示页面', key: 'flow:view' },
      { title: '搜索框', key: 'flow:search' },
      { title: '借用按钮', key: 'flow:borrow' },
      { title: '出库按钮', key: 'flow:checkout' },
      { title: '强制出库按钮', key: 'flow:checkout:force' },
      { title: '入库按钮', key: 'flow:checkin' },
      { title: '预约按钮', key: 'flow:reserve' },
      { title: '删除按钮', key: 'flow:delete' },
    ],
  },
  {
    title: '仪器管理',
    key: 'instrument',
    children: [
      { title: '显示页面', key: 'instrument:view' },
      { title: '搜索框', key: 'instrument:search' },
      { title: '新增仪器按钮', key: 'instrument:add' },
      { title: '编辑仪器按钮', key: 'instrument:edit' },
      { title: '删除仪器按钮', key: 'instrument:delete' },
      { title: '敏感信息显示', key: 'instrument:view_sensitive' },
      { title: '导入按钮', key: 'instrument:import' },
      { title: '导出按钮', key: 'instrument:export' },
      { title: '合并分组按钮', key: 'instrument:merge' },
      { title: '取消合并按钮', key: 'instrument:unmerge' },
      { title: '智能整理按钮', key: 'instrument:organize' },
      { title: '打印标签按钮', key: 'instrument:print_qr' },
      { title: '扫码功能', key: 'instrument:scan' },
      { title: '历史记录显示', key: 'instrument:history' },
    ],
  },
  {
    title: '影刀联用',
    key: 'shadow_knife',
    children: [
      {
        title: '联用任务台',
        key: 'shadow_knife:task',
        children: [
          { title: '显示页面', key: 'shadow_knife:task:view' },
          { title: '新增任务', key: 'shadow_knife:task:add' },
          { title: '编辑任务', key: 'shadow_knife:task:edit' },
          { title: '删除任务', key: 'shadow_knife:task:delete' },
        ],
      },
      {
        title: '写入规则',
        key: 'shadow_knife:rule',
        children: [
          { title: '显示页面', key: 'shadow_knife:rule:view' },
          { title: '新增规则', key: 'shadow_knife:rule:add' },
          { title: '编辑规则', key: 'shadow_knife:rule:edit' },
          { title: '删除规则', key: 'shadow_knife:rule:delete' },
          { title: '批量导入', key: 'shadow_knife:rule:import' },
        ],
      },
    ],
  },
  {
    title: '数据统计',
    key: 'stats',
    children: [
      {
        title: '仪器统计',
        key: 'stats:instrument',
        children: [
          { title: '显示页面', key: 'stats:instrument:view' },
          { title: '保存视图按钮', key: 'stats:instrument:save_view' },
        ],
      },
      {
        title: '使用与消耗',
        key: 'stats:usage',
        children: [
          { title: '显示页面', key: 'stats:usage:view' },
          { title: '搜索按钮', key: 'stats:usage:search' },
          { title: '编辑按钮', key: 'stats:usage:edit' },
          { title: '删除按钮', key: 'stats:usage:delete' },
          { title: '导出按钮', key: 'stats:usage:export' },
        ],
      },
      {
        title: '预警统计',
        key: 'stats:alert',
        children: [
          { title: '显示页面', key: 'stats:alert:view' },
        ],
      },
      {
        title: '维护统计',
        key: 'stats:maintenance',
        children: [
          { title: '显示页面', key: 'stats:maintenance:view' },
        ],
      },
    ],
  },
  {
    title: '系统管理',
    key: 'system',
    children: [
      {
        title: '角色管理',
        key: 'system:role',
        children: [
          { title: '角色模板弹窗显示', key: 'system:role:view' },
          { title: '保存角色模板按钮', key: 'system:role:edit' },
          { title: '重置角色模板按钮', key: 'system:role:reset' },
        ],
      },
      {
        title: '用户管理',
        key: 'system:user',
        children: [
          { title: '显示页面', key: 'system:user:view' },
          { title: '新增用户按钮', key: 'system:user:add' },
          { title: '编辑用户按钮', key: 'system:user:edit' },
          { title: '权限配置按钮', key: 'system:user:perm' },
          { title: '删除用户按钮', key: 'system:user:delete' },
        ],
      },
      {
        title: '系统配置',
        key: 'system:config',
        children: [
          { title: '显示页面', key: 'system:config:view' },
          { title: '保存配置按钮', key: 'system:config:edit' },
        ],
      },
      {
        title: '模板管理',
        key: 'system:template',
        children: [
          { title: '显示页面', key: 'system:template:view' },
          { title: '新增模板按钮', key: 'system:template:add' },
          { title: '编辑模板按钮', key: 'system:template:edit' },
          { title: '删除模板按钮', key: 'system:template:delete' },
          { title: '下载模板按钮', key: 'system:template:download' },
        ],
      },
      {
        title: '数据备份',
        key: 'system:backup',
        children: [
          { title: '显示页面', key: 'system:backup:view' },
          { title: '备份策略配置', key: 'system:backup:strategy' },
          { title: '手动备份按钮', key: 'system:backup:create' },
          { title: '恢复按钮', key: 'system:backup:restore' },
          { title: '删除备份按钮', key: 'system:backup:delete' },
        ],
      },
      {
        title: '系统维护',
        key: 'system:maintenance',
        children: [
          { title: '显示页面', key: 'system:maintenance:view' },
          { title: '保存配置按钮', key: 'system:maintenance:edit' },
          { title: '清理缓存按钮', key: 'system:maintenance:clean_cache' },
          { title: '分析索引按钮', key: 'system:maintenance:analyze_index' },
        ],
      },
      {
        title: '操作日志',
        key: 'system:audit',
        children: [
          { title: '显示页面', key: 'system:audit:view' },
          { title: '导出日志按钮', key: 'system:audit:export' },
          { title: '清空日志按钮', key: 'system:audit:clean' },
        ],
      },
    ],
  },
  {
    title: '一键转送',
    key: 'transfer',
    children: [
      { title: '查看任务', key: 'transfer:view' },
      { title: '执行处理', key: 'transfer:process' },
      { title: '模板设置', key: 'transfer:settings' },
    ],
  },
];

const getLeafKeys = (nodes: DataNode[]): string[] => {
  let keys: string[] = [];
  nodes.forEach((node) => {
    if (node.children && node.children.length > 0) {
      keys = [...keys, ...getLeafKeys(node.children)];
    } else {
      keys.push(node.key as string);
    }
  });
  return keys;
};

export const ALL_PERMISSIONS = getLeafKeys(PERMISSION_TREE);

const BASE_PERMISSIONS = [
  'dashboard:alert:view',
  'dashboard:schedule:view',
  'flow:view',
  'flow:search',
  'instrument:view',
  'instrument:search',
  'shadow_knife:task:view',
  'shadow_knife:rule:view',
  'stats:instrument:view',
  'stats:usage:view',
  'stats:usage:search',
  'transfer:view',
  'transfer:process',
  'transfer:settings',
];

export const ROLE_TEMPLATES: Record<string, string[]> = {
  admin: ALL_PERMISSIONS,
  transfer_operator: [
    'transfer:view',
    'transfer:process',
    'transfer:settings',
  ],
  shadow_knife_operator: [
    'shadow_knife:task:view',
    'shadow_knife:task:add',
    'shadow_knife:task:edit',
    'shadow_knife:task:delete',
    'shadow_knife:rule:view',
    'shadow_knife:rule:add',
    'shadow_knife:rule:edit',
    'shadow_knife:rule:delete',
    'shadow_knife:rule:import',
  ],
  principal: [
    ...BASE_PERMISSIONS,
    'dashboard:alert:process',
    'dashboard:alert:delete',
    'dashboard:schedule:edit',
    'dashboard:schedule:insert_row',
    'dashboard:schedule:delete_row',
    'dashboard:schedule:merge',
    'dashboard:schedule:split',
    'dashboard:schedule:clear',
    'dashboard:schedule:undo',
    'flow:borrow',
    'flow:checkout',
    'flow:checkin',
    'flow:reserve',
    'flow:delete',
    'flow:checkout:force',
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
    'shadow_knife:task:add',
    'shadow_knife:task:edit',
    'shadow_knife:task:delete',
    'shadow_knife:rule:add',
    'shadow_knife:rule:edit',
    'shadow_knife:rule:delete',
    'shadow_knife:rule:import',
    'stats:instrument:save_view',
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
    'system:config:view',
    'system:config:edit',
    'system:template:view',
    'system:template:add',
    'system:template:edit',
    'system:template:download',
    'system:backup:view',
    'system:backup:strategy',
    'system:backup:create',
    'system:backup:restore',
    'system:audit:view',
    'system:audit:export',
  ],
  device_manager: [
    ...BASE_PERMISSIONS,
    'dashboard:alert:process',
    'dashboard:schedule:edit',
    'dashboard:schedule:undo',
    'flow:borrow',
    'flow:checkout',
    'flow:checkin',
    'flow:reserve',
    'instrument:edit',
    'instrument:organize',
    'instrument:scan',
    'instrument:history',
    'shadow_knife:task:add',
    'shadow_knife:task:edit',
    'shadow_knife:rule:add',
    'shadow_knife:rule:edit',
    'shadow_knife:rule:import',
    'stats:usage:export',
  ],
  engineer: [
    ...BASE_PERMISSIONS,
    'flow:checkout',
    'flow:checkin',
    'instrument:history',
  ],
  viewer: [
    'dashboard:alert:view',
    'dashboard:schedule:view',
    'flow:view',
    'instrument:view',
    'shadow_knife:task:view',
    'shadow_knife:rule:view',
    'stats:instrument:view',
    'stats:usage:view',
    'stats:alert:view',
    'stats:maintenance:view',
  ],
};

const STORAGE_KEY = 'custom_role_templates';

export const getRoleTemplates = (): Record<string, string[]> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const customTemplates = JSON.parse(stored);
      return { ...ROLE_TEMPLATES, ...customTemplates };
    }
  } catch (error) {
    console.error('Failed to load role templates', error);
  }

  return ROLE_TEMPLATES;
};

export const saveRoleTemplates = (templates: Record<string, string[]>) => {
  try {
    const { admin, ...others } = templates;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(others));
    window.dispatchEvent(new Event('role-templates-changed'));
  } catch (error) {
    console.error('Failed to save role templates', error);
  }
};
