export const DEPARTMENT_OPTIONS = ['全部', '理化', '热学', '长度', '力学', '电学'] as const;

export const DEPARTMENT_SELECT_OPTIONS = DEPARTMENT_OPTIONS.map((item) => ({
  label: item,
  value: item,
}));
