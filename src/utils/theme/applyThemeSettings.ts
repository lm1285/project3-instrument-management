import { SystemSettings } from '../../types/common';

const DEFAULT_SIDEBAR_BG = 'linear-gradient(90deg, #141E30 0%, #243B55 100%)';
const DEFAULT_MODULE_HEADER_BG = 'linear-gradient(90deg, #141E30 0%, #243B55 100%)';
const DEFAULT_SIDEBAR_FONT_SIZE = 18;
const DEFAULT_MODULE_HEADER_FONT_SIZE = 30;
const DEFAULT_FONT_FAMILY = "'Times New Roman', 'SimSun', 'Songti SC', serif";
const LEGACY_SIDEBAR_FONT_SIZES = new Set([14, 16, 25, 35]);

function setCssVar(name: string, value?: string | null) {
  const root = document.documentElement;

  if (value === undefined || value === null || value === '') {
    root.style.removeProperty(name);
    return;
  }

  root.style.setProperty(name, value);
}

function resolveSidebarFontSize(sidebarFontSize?: number) {
  if (!sidebarFontSize || LEGACY_SIDEBAR_FONT_SIZES.has(sidebarFontSize)) {
    return DEFAULT_SIDEBAR_FONT_SIZE;
  }

  return sidebarFontSize;
}

function resolveModuleHeaderFontSize(moduleTitleFontSize?: number) {
  if (moduleTitleFontSize && moduleTitleFontSize > 35) {
    return moduleTitleFontSize;
  }

  return DEFAULT_MODULE_HEADER_FONT_SIZE;
}

export function applyThemeSettings(settings: SystemSettings) {
  const root = document.documentElement;
  const { theme, layout, table, typography } = settings;
  const navigationFontSize = `${resolveSidebarFontSize(theme.sidebarFontSize)}px`;
  const contentFontSize = theme.contentFontSize ? `${theme.contentFontSize}px` : navigationFontSize;
  const globalFontFamily = typography.fontFamily || DEFAULT_FONT_FAMILY;

  setCssVar('--background-color', theme.background);
  setCssVar('--card-background', theme.cardBackground);
  setCssVar('--text-primary', theme.textPrimary);
  setCssVar('--text-secondary', theme.textSecondary);
  setCssVar('--border-color', theme.borderColor);
  setCssVar('--primary-color', theme.primaryColor);
  setCssVar('--info-color', theme.infoColor || theme.primaryColor);
  setCssVar('--success-color', theme.successColor);
  setCssVar('--warning-color', theme.warningColor);
  setCssVar('--error-color', theme.errorColor);
  setCssVar('--secondary-color', theme.secondaryColor);

  setCssVar('--sidebar-bg', theme.sidebarColor || DEFAULT_SIDEBAR_BG);
  setCssVar('--sidebar-text-color', theme.sidebarTextColor);
  setCssVar('--sidebar-font-size', `${resolveSidebarFontSize(theme.sidebarFontSize)}px`);
  setCssVar('--navigation-font-size', navigationFontSize);
  setCssVar('--title-font-size', `${Math.max(resolveSidebarFontSize(theme.sidebarFontSize) + 2, 18)}px`);
  setCssVar('--subtitle-font-size', `${Math.max(resolveSidebarFontSize(theme.sidebarFontSize) - 2, 14)}px`);
  setCssVar('--small-font-size', `${Math.max(resolveSidebarFontSize(theme.sidebarFontSize) - 4, 12)}px`);
  setCssVar('--table-font-size', `${Math.max(resolveSidebarFontSize(theme.sidebarFontSize) - 1, 15)}px`);
  setCssVar('--app-font-family', globalFontFamily);
  setCssVar('--sidebar-line-height', theme.sidebarLineHeight ? String(theme.sidebarLineHeight) : null);
  setCssVar('--sidebar-item-hover-bg', theme.sidebarItemHoverBg);
  setCssVar('--sidebar-user-bg', theme.sidebarUserBg);

  setCssVar('--module-header-bg', theme.moduleTitleColor || DEFAULT_MODULE_HEADER_BG);
  setCssVar('--module-header-text-color', theme.moduleTitleTextColor);
  setCssVar('--module-header-font-size', `${resolveModuleHeaderFontSize(theme.moduleTitleFontSize)}px`);
  setCssVar('--module-header-line-height', theme.moduleTitleLineHeight ? String(theme.moduleTitleLineHeight) : null);

  setCssVar('--button-color', theme.buttonColor);
  setCssVar('--button-text-color', theme.buttonTextColor);
  setCssVar('--button-font-size', navigationFontSize);
  setCssVar('--button-line-height', theme.buttonLineHeight ? String(theme.buttonLineHeight) : null);

  setCssVar('--content-font-size', contentFontSize);
  setCssVar('--content-line-height', theme.contentLineHeight ? String(theme.contentLineHeight) : null);
  setCssVar('--transition-duration', theme.enableAnimation ? '0.3s' : '0s');
  setCssVar('--table-row-height', `${table?.rowHeight ?? 47}px`);
  setCssVar('--mask-opacity', '0.45');

  const borderRadius = typeof theme.customBorderRadius === 'number'
    ? `${theme.customBorderRadius}px`
    : layout?.borderRadius === 'sm'
      ? '8px'
      : layout?.borderRadius === 'lg'
        ? '16px'
        : '12px';

  const boxShadow =
    layout?.shadow === 'sm' ? '0 2px 8px rgba(0,0,0,0.08)' :
    layout?.shadow === 'lg' ? '0 8px 24px rgba(0,0,0,0.15)' :
    '0 4px 16px rgba(0,0,0,0.12)';

  const controlHeight =
    layout?.density === 'compact' ? '36px' :
    layout?.density === 'comfortable' ? '52px' :
    '44px';

  setCssVar('--border-radius-sm', borderRadius);
  setCssVar('--border-radius-md', borderRadius);
  setCssVar('--border-radius-lg', borderRadius);
  setCssVar('--box-shadow-sm', boxShadow);
  setCssVar('--box-shadow-md', boxShadow);
  setCssVar('--box-shadow-lg', boxShadow);
  setCssVar('--button-height-min', controlHeight);
  setCssVar('--input-height-min', controlHeight);

  document.body.style.fontFamily = globalFontFamily;
  document.body.style.fontSize = navigationFontSize;
  document.body.style.lineHeight = typography.lineHeight;
  document.body.setAttribute('data-theme', theme.mode === 'dark' ? 'dark' : 'light');
  document.body.setAttribute('data-gray-mode', String(Boolean(theme.grayMode)));
  document.body.setAttribute('data-color-weak', String(Boolean(theme.colorWeak)));

  root.style.colorScheme = theme.mode === 'dark' ? 'dark' : 'light';
}
