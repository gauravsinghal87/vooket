# Address Search & Geocoding

This document explains how location/geocoding works across the customer web app and the
backend, the provider architecture (Google → Nominatim fallback, deterministic mock),
and how to diagnose a `REQUEST_DENIED`.

## Summary

- **Google** is the primary provider for address search, place details, and reverse
  geocoding. It is driven server-side using the **server/backend key**.
- **Nominatim (OpenStreetMap)** is used **only** as a fallback when a Google request
  fails. It needs no API key.
- In **mock mode** (no keys), the deterministic `MockMapsProvider` answers without any
  external HTTP calls, so development/tests stay offline.
- If Google is not configured with a server key, the system stays in mock mode (it does
  **not** silently call Nominatim on every request).

## Provider selection (`GeocodingService::lane()`)

| Lane | When selected |
|------|---------------|
| `google` | The admin-configured maps provider is `google` **and** a server key is set (DB integration settings override env). This is honoured even in `THIRD_PARTY_MODE=mock` because keys stored in the integration hub are intended to be used. |
| `mock` | Everything else (no key, or provider is `mock`). Deterministic + offline. |

Nominatim is never a primary lane. It is reached only when a selected Google request
fails (`REQUEST_DENIED`, timeout, no results, etc.). Every search response includes
`{ provider, fallback, correlation_id }` so the UI can show a friendly notice when a
fallback was used.

## Provider layer

- `app/Infrastructure/Interfaces/MapProviderInterface.php` — `geocode`,
  `reverseGeocode`, `placesAutocomplete`, `placeDetails`, `distanceMatrix`,
  `directions`, `calculateDistanceAndTime`, `validateAddress`.
- `GoogleMapsProvider` — real Google calls.
  - **Autocomplete** and **Place Details** use the **Places API (New)**
    (POST `places:searchText`, GET `/places/{id}` with `X-Goog-Api-Key` + FieldMask).
    This returns coordinates + a stable `place_id` in a single request.
  - **Geocode / reverse** use the legacy Geocoding API (`geocode/json`).
- `MockMapsProvider` — deterministic mock shapes that mirror the Google shapes so all
  lanes share one normalisation path.
- `NominatimProvider` — fallback-only wrapper (adheres to Nominatim's usage policy with a
  proper `User-Agent`/`Referer`). **Not** registered in `IntegrationManager::TABLE`.

## Enabling Google (diagnosing REQUEST_DENIED)

A `REQUEST_DENIED` generally means one of the following on the **Google Cloud project**:

1. **Billing is not enabled** on the project.
   - Google returns: `You must enable Billing on the Google Cloud Project`.
2. The required APIs are not enabled:
   - **Geocoding API** (for geocode/reverse).
   - **Places API (New)** (for autocomplete/details). The legacy `Places API` is
     deprecated for this key — Google recommends the Places API (New).

### How to diagnose in the admin panel

1. Open **Integrations → Google Maps**.
2. Ensure the **Server/backend API key** is filled in (keys are masked, never shown).
3. Click **Test connection**.
   - The stored `last_test_message` now includes the exact Google error (e.g.
     "You must enable Billing on the Google Cloud Project") plus guidance.
4. In logs, search for `Google Maps request failed; falling back to Nominatim` with
   `google_status=REQUEST_DENIED`, `google_error=<message>`, and a `correlation_id`.
   **API keys are never logged** — only the status and error text.

The browser key is **only** used client-side to render the map. The server key is never
exposed by `GET /app-config` (only `public_key`).

## Persisting an address

`AddressController` accepts `place_id` and `formatted_address` (added via migration
`add_place_fields_to_addresses_table`). The `addresses` table has indexed `place_id`
and a `formatted_address` column. When latitude/longitude are missing and
`services.geocoding.enabled` is true, the controller geocodes automatically.

## Frontend

- `customer-web/src/lib/location.ts` — default/popular locations and raw geolocation.
- `customer-web/src/components/map/MapPicker.tsx` — map picker: server search
  (min 2 chars, 350 ms debounce, stale-response abort), draggable marker with debounced
  reverse geocode, geolocation error messages, and it carries `place_id` +
  `formatted_address` through to the selected place.
- `customer-web/src/components/layout/location-selector.tsx` — the header sheet. It now
  searches the server API (`/geocode/search`) and reverse-geocodes the GPS position so
  the chosen location carries real coordinates.
- The active delivery location (app store, persisted under `sb-app`) is used to pass
  `latitude`/`longitude` to `/food/restaurants`, `/grocery/stores`, and the rides
  estimate/book calls.
