/**
 * RIDES THEME — the single design-token entry point for Rides screens.
 * Blue mobility identity, built on the shared brand ramp. Food and Grocery
 * never import it.
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

export const ridesTheme = {
  colors: {
    primary: colors.brand[600],
    primaryDark: colors.brand[700],
    primarySoft: colors.brand[50],
    onPrimary: colors.white,
    accent: colors.brand[600],
    surface: colors.white,
    canvas: colors.ink[50],
    text: colors.ink[900],
    muted: colors.neutral[500],
    border: colors.ink[100],
    pickup: colors.zGreen,
    drop: colors.food[600],
    driver: colors.brand[600],
  },
  typography,
  spacing,
  radii,
  shadows,
  hero: HERO_THEMES.rides,
  service: SERVICE_THEMES.rides,
  overlay: withAlpha(colors.ink[950], 0.55),
  map: {
    minHeight: 300,
    borderRadius: radii['2xl'],
  },
} as const;
