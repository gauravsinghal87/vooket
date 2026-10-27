/**
 * Data source flag.
 *
 * The web app toggles between mock and API data at build time. On mobile the
 * app always talks to the real backend (no test fixtures shipped), so this is
 * constant `false`. Set EXPO_PUBLIC_DATA_SOURCE=mock only for local UI
 * development against fixture-less delays.
 */
export const IS_MOCK = (process.env.EXPO_PUBLIC_DATA_SOURCE ?? 'api') === 'mock';