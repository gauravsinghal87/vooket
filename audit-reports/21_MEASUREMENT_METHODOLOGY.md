# Measurement Methodology

Date: 2026-11-02

## Web runtime

1. Built `customer-web-optimized` with `VITE_API_BASE_URL=/api/v1 npm run build`.
2. Served `dist` with a temporary Node static server on `localhost:4310`.
3. Proxied `/api/v1/*` from that server to `https://vooketapi.expertshub.in`, preserving same-origin browser requests.
4. Set the persisted app location to Jaipur South (`latitude: 26.85`, `longitude: 75.80`) in `localStorage` and reloaded.
5. Read browser `PerformanceNavigationTiming`, `PerformancePaintTiming` and `PerformanceResourceTiming` entries.
6. Clicked the module switcher inside the SPA; filtered resource entries with `startTime` after the click.
7. For cache diagnosis, temporarily exposed the QueryClient on `window` and read query keys/state; the diagnostic global was removed before the final build.

## Why Jaipur South

- Delhi default coordinates are outside the serviceable zone for Food and Grocery.
- Jaipur South returns both Food and Grocery serviceable data, making module-switch comparisons meaningful.

## API profiling

- Live endpoints were measured with `curl`/browser timings against production.
- Local Laravel profiling used a read-only kernel dispatch script to capture status, time, bytes, query count and SQL time.
- The local DB has a small dataset, so query timings are not production-scale; query counts and payload shapes are the main signals.

## Bundle measurements

- Raw and gzip sizes came from the Vite build output.
- Browser decoded/transfer bytes came from `PerformanceResourceTiming`.
- The category PNG size is reported from the build output and filesystem.

## What is not measured

- React render counts/time; no Profiler instrumentation.
- Production DB slow-query log/EXPLAIN.
- Mobile cold start/JS frame timing; no device/emulator.
- CDN cache hit ratio.
- Multi-run statistical variance; measurements are from a single session unless a baseline value is explicitly cited.

## Reproducibility notes

- The proxy script lives outside the repository in the temporary workspace and is not a shipped artifact.
- Production API latency varied between runs (earlier ~0.85 s TTFB; later ~2 s calls). Payload and request-count comparisons are more reliable than absolute duration comparisons.
