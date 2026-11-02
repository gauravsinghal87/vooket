import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

let pending: Promise<void> | null = null;
let activeKey: string | null = null;

/**
 * Loads the Google Maps JS API once per browser key and caches the promise so
 * multiple components (rides map, location pickers) share a single bootstrap.
 * On failure the cache is dropped so a later retry can succeed.
 */
export function loadGoogleMaps(apiKey: string): Promise<void> {
  if (pending && activeKey === apiKey) return pending;

  activeKey = apiKey;
  setOptions({ key: apiKey, v: 'weekly', libraries: ['maps', 'marker', 'geometry'] });

  pending = (async () => {
    await importLibrary('maps');
    await importLibrary('marker');
    await importLibrary('geometry');
  })();

  pending.catch(() => {
    if (activeKey === apiKey) pending = null;
  });

  return pending;
}