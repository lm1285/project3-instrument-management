export const MODULE_AVAILABILITY = {
  dashboard: false,
  schedule: false,
  shadowKnife: false,
  instrumentFlow: false,
  instrumentManagement: false,
  statistics: false,
  oneClickTransfer: true,
  systemSettings: true,
} as const;

const DISABLED_ROUTE_PREFIXES = [
  '/dashboard',
  '/shadow-knife-linkage',
  '/length-shadow-linkage',
  '/instrument-flow',
  '/instrument-mgmt',
  '/statistics',
] as const;

export function isRouteEnabled(pathname: string): boolean {
  if (DISABLED_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return false;
  }
  return true;
}

export function isModuleEnabled(moduleId: string): boolean {
  if (moduleId === 'shadowKnifeLinkage' || moduleId === 'shadowKnifeTaskBoard' || moduleId === 'shadowKnifeLengthRules') {
    return MODULE_AVAILABILITY.shadowKnife;
  }
  if (moduleId === 'instrumentMgmt') {
    return MODULE_AVAILABILITY.instrumentManagement;
  }
  return MODULE_AVAILABILITY[moduleId as keyof typeof MODULE_AVAILABILITY] ?? true;
}
