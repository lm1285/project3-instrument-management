export const MODULE_AVAILABILITY = {
  alerts: false,
  schedule: false,
  instrumentFlow: false,
  instruments: false,
  statistics: false,
  shadowKnife: false,
  oneClickTransfer: true,
  system: true,
} as const;

const DISABLED_API_PREFIXES = [
  '/api/alerts',
  '/api/schedule',
  '/api/flow',
  '/api/instruments',
  '/api/statistics',
  '/api/excel-templates',
  '/api/length-shadow-linkage',
  '/api/shadow-knife-linkage',
  '/api/history',
  '/api/merge-groups',
  '/api/instruments/groups',
  '/api/groups',
] as const;

export function isDisabledApiPath(pathname: string): boolean {
  return DISABLED_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
