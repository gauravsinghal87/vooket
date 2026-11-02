/**
 * GROCERY THEME — the single design-token entry point for Grocery screens.
 * Warm yellow / cream quick-commerce palette. Food and Rides never import it.
 */
import {
  colors,
  HERO_THEMES,
  radii,
  SERVICE_THEMES,
  shadows,
  spacing,
  typography,
  withAlpha,
} from '@/shared/theme';

export * from '@/shared/theme';

export const groceryTheme = {
  colors: {
    primary: colors.grocery[500],
    primaryDark: colors.grocery[700],
    primarySoft: colors.grocery[100],
    onPrimary: colors.ink[900],
    accent: colors.grocery[600],
    surface: colors.white,
    canvas: colors.grocery[50],
    band: colors.grocery[200],
    bandStrong: colors.grocery[300],
    text: colors.ink[900],
    muted: colors.neutral[500],
    border: colors.ink[100],
    success: colors.success,
    danger: colors.danger,
  },
  typography,
  spacing,
  radii,
  shadows,
  hero: HERO_THEMES.grocery,
  service: SERVICE_THEMES.grocery,
  overlay: withAlpha(colors.ink[950], 0.55),
} as const;
