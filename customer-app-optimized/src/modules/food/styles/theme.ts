/**
 * FOOD THEME — the single design-token entry point for Food screens.
 *
 * Values are ported from the shared token source and the pre-refactor Food
 * palette; nothing here is inferred or "improved". Grocery and Rides never
 * import this file.
 */
import {
  colors,
  featured,
  HERO_THEMES,
  notch,
  radii,
  SERVICE_THEMES,
  shadows,
  spacing,
  typography,
  withAlpha,
} from '@/shared/theme';

export * from '@/shared/theme';

export const foodTheme = {
  colors: {
    primary: colors.food[600],
    primaryDark: colors.food[700],
    primarySoft: colors.food[50],
    onPrimary: colors.white,
    accent: colors.zRed,
    veg: colors.zGreen,
    vegSoft: colors.zGreenSoft,
    pro: colors.zGold,
    proSoft: colors.zGoldSoft,
    info: colors.zInfo,
    infoSoft: colors.zInfoSoft,
    surface: colors.white,
    canvas: colors.ink[50],
    text: colors.ink[900],
    muted: colors.neutral[500],
    border: colors.ink[100],
  },
  typography,
  spacing,
  radii,
  shadows,
  notch,
  featured,
  hero: HERO_THEMES.food,
  service: SERVICE_THEMES.food,
  overlay: withAlpha(colors.ink[950], 0.72),
} as const;
