You are working on my existing all-in-one application that combines:

- Food delivery similar to Zomato
- Grocery delivery similar to Blinkit
- Ride booking similar to Uber

Existing main folders include approximately:

- `backend` → Laravel backend/API
- `admin-web` → React Super Admin panel
- `vendor-web` → React restaurant/grocery vendor panel
- `partner-web` → React delivery partner + ride driver panel
- `customer-web` → React customer application

IMPORTANT:

This is an EXISTING project with existing authentication, modules, database schema, APIs, order flow, roles, vendor logic, partner logic, ride logic, UI components and coding conventions.

DO NOT blindly rebuild the project.

DO NOT create duplicate modules if equivalent modules already exist.

DO NOT replace working functionality unnecessarily.

DO NOT ask me to explain files that you can inspect yourself.

FIRST inspect the repository thoroughly, understand the current architecture and then integrate the requirements below into the existing architecture.

Your job is to fully analyze, design, implement, migrate, integrate and test the following systems:

1. Google Maps integration management in Super Admin
2. Common Maps infrastructure
3. Customer location/address selection
4. Food delivery tracking
5. Grocery delivery tracking
6. Ride tracking
7. Delivery partner navigation
8. Ride driver navigation
9. Real-time GPS tracking
10. Routes and ETA
11. Nearby partner/driver selection
12. Zone management
13. Zone-based serviceability
14. Zone-based partner/driver assignment
15. Google Maps API configuration and security
16. End-to-end integration between all relevant applications

==================================================
PHASE 0 — DO NOT CODE BEFORE AUDITING
==================================================

First analyze the complete repository.

Inspect:

- Laravel version
- PHP version
- MySQL version
- React versions
- routing structure
- auth architecture
- RBAC/permissions
- Super Admin modules
- integration/settings modules
- existing `Integrations` page
- existing Google integration card if present
- database structure
- migrations
- models
- controllers
- services
- repositories
- jobs/queues
- events/listeners
- broadcasting
- WebSocket implementation
- Laravel Reverb/Pusher/Soketi/etc. if already present
- notification system
- food order lifecycle
- grocery order lifecycle
- ride lifecycle
- restaurant/store location storage
- customer address storage
- delivery partner model
- driver model
- partner availability
- driver availability
- existing location columns
- existing latitude/longitude fields
- existing map-related code
- vendor assignment
- delivery assignment
- ride assignment
- partner service types
- admin configuration storage
- secret/encryption mechanisms
- frontend state management
- API client architecture
- environment/config patterns
- existing tests

Search for terms such as:

`google`
`maps`
`location`
`latitude`
`longitude`
`lat`
`lng`
`geo`
`distance`
`route`
`driver`
`partner`
`delivery`
`ride`
`order`
`vendor`
`restaurant`
`grocery`
`integration`
`setting`
`broadcast`
`reverb`
`pusher`
`websocket`
`zone`

Before implementation produce an internal audit containing:

A. Existing architecture  
B. Existing functionality that can be reused  
C. Missing functionality  
D. Database changes required  
E. Backend changes required  
F. admin-web changes required  
G. customer-web changes required  
H. partner-web changes required  
I. vendor-web changes required, if any  
J. Realtime infrastructure status  
K. Risks/regressions to avoid  

Then implement.

Do NOT stop after giving me the audit.

Continue through implementation.

==================================================
PART 1 — GOOGLE MAPS INTEGRATION IN SUPER ADMIN
==================================================

Find the existing:

Super Admin → Integrations

page/module.

Find the existing Google/Google Maps integration card if it exists.

Modify the existing card instead of creating an unrelated duplicate integration screen.

It should support a production-ready Google Maps configuration.

Suggested fields:

Google Maps Enabled:
- enabled / disabled

Environment:
- demo/development
- production

Browser Maps API Key:
- used by React applications
- HTTP-referrer-restricted key

Server Maps API Key:
- used only by Laravel
- NEVER expose this key to React

Optional:
- Google Map ID
- default country
- default region
- default language
- distance unit
- default map zoom
- route refresh interval
- live location interval
- driver search radius
- partner search radius
- max Route Matrix candidates
- job request timeout
- Google Roads enabled/disabled

API capability indicators/toggles:

- Maps JavaScript API
- Places API (New)
- Routes API
- Geocoding API v4
- Roads API - optional

Do not require separate API keys for food/grocery/ride.

They use the same Google Maps Platform configuration.

However use TWO credential roles:

1. Browser key
2. Server key

==================================================
SECRET SECURITY
==================================================

Server API key must:

- be stored encrypted at rest
- never be returned through normal API responses
- never appear in frontend source
- never appear in logs
- never appear in exceptions
- never appear in browser devtools

Reuse the project's existing secret/encryption mechanism where available.

Otherwise use Laravel encrypted casting / Crypt appropriately.

Browser API key may be returned by a controlled public configuration endpoint because browser Maps JavaScript requires it, but it must be treated as a restricted browser credential.

Create something conceptually similar to:

GET /api/public/maps/config

Response should contain only safe browser configuration:

{
  "enabled": true,
  "browser_key": "...",
  "map_id": "...",
  "default_country": "IN",
  "default_region": "IN",
  "default_language": "en",
  "tracking_interval": 4
}

NEVER include server key.

Because React/Vite builds cannot reliably change `.env` dynamically after build, use runtime configuration from Laravel where appropriate rather than forcing API keys into compile-time environment variables.

==================================================
INTEGRATION TESTING UI
==================================================

Add appropriate testing controls to Google Maps integration card.

Examples:

- Test Browser Map
- Test Server API
- Test Routes
- Test Geocoding
- Test Places

Show:

Connected
Failed
Disabled
Configuration incomplete

with meaningful errors.

Do not expose raw Google secret values in errors.

==================================================
PART 2 — GOOGLE SERVICES TO IMPLEMENT
==================================================

Create a centralized Laravel Google Maps service architecture.

Adapt names to current project conventions.

Conceptually:

app/Services/Maps/
    GoogleMapsConfigService.php
    GooglePlacesService.php
    GoogleRoutesService.php
    GoogleGeocodingService.php
    GoogleRoadsService.php
    LocationService.php
    ServiceabilityService.php
    PartnerMatchingService.php

Do not duplicate existing services if equivalents exist.

==================================================
GOOGLE MAPS JAVASCRIPT
==================================================

Use Maps JavaScript API to display:

- map
- customer marker
- vendor marker
- restaurant marker
- grocery store marker
- delivery partner marker
- driver marker
- pickup marker
- destination marker
- polylines
- routes
- service zones

Build reusable React map components/hooks where architecture allows.

Do not copy-paste separate map implementations into every application.

==================================================
PLACES API NEW
==================================================

Implement address autocomplete.

Google endpoint:

POST
https://places.googleapis.com/v1/places:autocomplete

Implement Place Details where needed:

GET
https://places.googleapis.com/v1/places/{PLACE_ID}

Use FieldMask correctly.

Use autocomplete session tokens where appropriate.

Store useful location information:

- place_id
- formatted_address
- latitude
- longitude
- city
- state
- postal_code
- country

Use India bias/restriction if current application is India-only.

Do not call Place Details repeatedly if valid coordinates are already stored.

Optional services if genuinely needed by current UI:

POST
https://places.googleapis.com/v1/places:searchText

POST
https://places.googleapis.com/v1/places:searchNearby

IMPORTANT:

Do NOT use Google's Nearby Search to find OUR registered restaurants/stores/partners/drivers.

Those entities belong to our own database.

Use our database for vendor/partner/driver discovery.

==================================================
ROUTES API
==================================================

Implement:

POST
https://routes.googleapis.com/directions/v2:computeRoutes

Use it for:

Food:
- partner → restaurant
- restaurant → customer

Grocery:
- partner → grocery store
- grocery store → customer

Ride:
- driver → customer pickup
- customer pickup → destination

Request useful fields only.

For example:

routes.duration
routes.distanceMeters
routes.polyline.encodedPolyline

Use:

travelMode = DRIVE

and appropriate traffic-aware routing where supported/configured.

Do not use wildcard FieldMask in production.

==================================================
ROUTE MATRIX
==================================================

Implement:

POST
https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix

Use this for selecting the best candidates from an already filtered nearby candidate list.

DO NOT send every online driver/partner in the system to Google.

Candidate algorithm should first use our database/Redis/geospatial filtering.

Example:

1000 online partners
↓
service type filter
↓
zone filter
↓
availability filter
↓
current location freshness filter
↓
distance filter
↓
top ~5 nearest candidates
↓
Google Route Matrix
↓
rank by road ETA
↓
offer job

Make candidate count configurable in Super Admin.

==================================================
GEOCODING API V4
==================================================

Implement forward geocoding if required:

GET
https://geocode.googleapis.com/v4/geocode/address/{ADDRESS}

Implement reverse geocoding:

GET
https://geocode.googleapis.com/v4/geocode/location/{LATITUDE},{LONGITUDE}

Do NOT geocode addresses unnecessarily when Places already returned a valid location.

==================================================
ROADS API
==================================================

This is OPTIONAL.

Endpoint:

GET
https://roads.googleapis.com/v1/snapToRoads

Use only if enabled.

Purpose:

smooth/noisy GPS correction.

Do not make it mandatory for MVP.

Do not call Roads API for every single GPS position by default.

==================================================
PART 3 — SUPER ADMIN ZONES MODULE
==================================================

Currently there is no proper zones functionality.

Implement a production-ready:

Super Admin → Zones

module.

Zone examples:

Jaipur Central
Jaipur North
Malviya Nagar
Vaishali Nagar
Mansarovar

A zone must support one or multiple service types:

- FOOD
- GROCERY
- RIDE

Example:

Zone A:
Food = enabled
Grocery = enabled
Ride = enabled

Zone B:
Food = enabled
Grocery = disabled
Ride = enabled

==================================================
ZONE DATABASE DESIGN
==================================================

First inspect existing database conventions.

Design accordingly.

A zone should contain approximately:

id
name
code
description
status

country
state
city

center_latitude
center_longitude

polygon / multipolygon geometry OR appropriate GeoJSON representation

food_enabled
grocery_enabled
ride_enabled

priority

food_partner_search_radius
grocery_partner_search_radius
ride_driver_search_radius

allow_cross_zone_food_delivery
allow_cross_zone_grocery_delivery
allow_ride_drop_outside_zone

created_by
updated_by
timestamps

Do not blindly use this exact schema if the current project has a cleaner configurable service architecture.

Prefer normalized zone-service configuration if existing architecture makes that better.

==================================================
GEOSPATIAL STORAGE
==================================================

Inspect the installed MySQL version.

If production environment supports appropriate spatial types, use:

POINT
POLYGON / MULTIPOLYGON
SRID 4326
spatial indexes

where appropriate.

Use database geospatial queries for authoritative backend checks.

GeoJSON coordinates are:

[longitude, latitude]

not:

[latitude, longitude]

Be careful not to reverse them.

Partner/customer/vendor location objects in application code may still use:

{
   lat: ...,
   lng: ...
}

Convert correctly at storage/query boundaries.

==================================================
ZONE MAP EDITOR
==================================================

Super Admin should be able to:

- Create zone
- Name zone
- Select city/state
- Enable services
- Draw boundary
- Edit boundary
- Move polygon vertices
- Delete vertices
- Save polygon
- Disable/enable zone
- View zone on map
- View multiple zones
- prevent invalid empty boundaries
- show approximate area
- show center
- show service types

VERY IMPORTANT:

DO NOT USE:

google.maps.drawing.DrawingManager

Google's old Maps JavaScript Drawing Library has been discontinued.

Use a maintained polygon drawing/editing solution such as:

Terra Draw

integrated with Google Maps,

OR implement a clean custom polygon editor using supported map APIs if the project already provides suitable infrastructure.

Do not build new code on deprecated DrawingManager.

==================================================
ZONE VALIDATION
==================================================

Validate zones server-side.

Reject:

- empty polygon
- fewer than 3 unique vertices
- invalid coordinate ranges
- malformed GeoJSON
- invalid polygon structures

Handle polygon closing correctly.

If overlapping zones are supported:

use priority.

If overlapping zones are not desired:

warn/block Super Admin.

Choose the policy based on current app architecture and document it.

Recommended:

Allow overlap only when deterministic priority exists.

==================================================
ZONE RESOLUTION
==================================================

Create reusable backend logic such as:

resolveZone(latitude, longitude, serviceType)

It should return:

- matching zone
- service enabled status
- priority
- serviceability result

Example:

GET /api/serviceability/resolve
    ?lat=26.x
    &lng=75.x
    &service=food

Possible result:

{
   "serviceable": true,
   "zone": {
      "id": 4,
      "name": "Malviya Nagar"
   },
   "service": "food"
}

If unavailable:

{
   "serviceable": false,
   "zone": null,
   "reason": "OUTSIDE_SERVICE_AREA"
}

Backend result must be authoritative.

Do not depend only on frontend polygon checks.

==================================================
PART 4 — VENDOR/STORE ZONE ASSIGNMENT
==================================================

Restaurants and grocery stores must belong to a service zone.

Whenever vendor/store location is:

- created
- updated
- approved
- relocated

resolve its coordinates against zones.

Store appropriate zone reference.

Examples:

restaurant.zone_id
store.zone_id

or reusable equivalent based on existing architecture.

Restaurant must belong to a FOOD-enabled zone.

Grocery store must belong to a GROCERY-enabled zone.

If location lies outside available service area:

flag it accordingly for Super Admin/vendor.

Do not silently assign an arbitrary zone.

==================================================
PART 5 — CUSTOMER SERVICEABILITY
==================================================

In `customer-web`, integrate location selection properly.

Customer should be able to:

- use current location
- search address
- choose address from Google autocomplete
- confirm location on map
- drag/adjust pin if current architecture supports it
- save address

Store:

place_id
latitude
longitude
formatted address
address metadata

As soon as location is selected:

resolve serviceability through Laravel.

==================================================
FOOD CUSTOMER FLOW
==================================================

When customer selects FOOD:

current/delivery location
↓
resolve FOOD zone
↓
show restaurants serviceable for that location
↓
customer selects restaurant
↓
checkout
↓
validate serviceability AGAIN on backend
↓
create order

Do not rely solely on frontend validation.

By default food delivery should follow:

Restaurant pickup zone == Customer delivery zone

unless:

allow_cross_zone_food_delivery = true

or the project implements explicit allowed zone pairs.

==================================================
GROCERY CUSTOMER FLOW
==================================================

Same architecture:

Customer location
↓
resolve GROCERY zone
↓
show serviceable grocery stores
↓
checkout
↓
backend revalidation
↓
order

Default:

Store zone == customer zone

unless cross-zone grocery delivery is explicitly enabled.

==================================================
RIDE CUSTOMER FLOW
==================================================

Customer chooses:

pickup
destination

Resolve pickup zone.

Ride must be allowed only if:

pickup belongs to an active RIDE-enabled zone.

Driver assignment is based on PICKUP zone.

Recommended default:

destination may be outside pickup zone if:

allow_ride_drop_outside_zone = true

Make this configurable.

If false, destination must also belong to valid ride service area.

==================================================
PART 6 — PARTNER / DRIVER CAPABILITIES
==================================================

Inspect existing partner structure before changing it.

We have conceptually:

FOOD DELIVERY PARTNER
GROCERY DELIVERY PARTNER
RIDE DRIVER

The current application's actual schema may use different roles/types.

Preserve it.

A food order must NEVER be offered to:

- grocery-only partner
- ride-only driver

A grocery order must NEVER be offered to:

- food-only partner
- ride-only driver

A ride must NEVER be offered to:

- food-only partner
- grocery-only partner

If partners support multiple capabilities, use capability-based filtering.

Example:

service_capabilities:
FOOD
GROCERY
RIDE

==================================================
PART 7 — PARTNER LIVE LOCATION
==================================================

When partner/driver goes online:

obtain device/browser GPS.

For current React web implementation use supported browser geolocation:

navigator.geolocation.watchPosition(...)

subject to permissions.

Capture:

latitude
longitude
accuracy
heading
speed
timestamp

Conceptual payload:

{
  "latitude": 26.9124,
  "longitude": 75.7873,
  "accuracy": 8,
  "heading": 125,
  "speed": 7.4,
  "timestamp": "..."
}

Create/adapt a Laravel endpoint such as:

POST /api/partner/location

or existing equivalent.

Do not create duplicate endpoint patterns unnecessarily.

==================================================
LOCATION FREQUENCY
==================================================

Recommended moving interval:

approximately 3-5 seconds.

Do NOT call Google Routes every 3 seconds.

GPS update:
Partner → Laravel → WebSocket → Customer

is OUR infrastructure.

Google does not need to be called for every marker movement.

When stationary, reduce update frequency where practical.

Track:

last_location_at

Partners with stale GPS should not receive jobs.

Example configurable freshness:

30-60 seconds.

==================================================
CURRENT ZONE FOR PARTNER
==================================================

Each meaningful partner GPS update should allow backend to determine current service zone.

Do this efficiently.

Do not execute unnecessarily expensive polygon queries every second.

Possible strategy:

- cache current zone
- recalculate on meaningful movement
- recalculate when no current zone
- recalculate when crossing likely boundary
- persist current_zone_id where architecture permits

Partner eligibility requires:

- online
- active
- verified if applicable
- not busy
- GPS fresh
- correct service capability
- current zone = job pickup zone
- within configured search radius

==================================================
PART 8 — JOB ASSIGNMENT ENGINE
==================================================

Build/refactor a reusable assignment service.

Do not unnecessarily merge completely separate existing order/ride models.

But centralize common matching logic where useful.

Conceptual flow:

JOB CREATED/READY FOR ASSIGNMENT
↓
determine service type
↓
determine pickup coordinates
↓
determine pickup zone
↓
find online candidates
↓
correct service capability
↓
same active zone
↓
not busy
↓
fresh location
↓
distance radius
↓
top N nearest
↓
Route Matrix
↓
rank by road ETA
↓
offer job
↓
accepted?
    YES → atomic assignment
    NO → next candidate
↓
continue until timeout/exhausted

==================================================
FOOD ASSIGNMENT
==================================================

Food order:

restaurant accepts/prepares order
↓
order reaches correct assignment state
↓
pickup = restaurant coordinates
↓
pickup zone = restaurant FOOD zone
↓
candidate type = FOOD delivery
↓
candidate current zone = pickup zone
↓
rank candidate
↓
job offer
↓
partner accepts
↓
assigned

==================================================
GROCERY ASSIGNMENT
==================================================

Grocery:

store packs/order becomes ready
↓
pickup = grocery store
↓
pickup zone = store GROCERY zone
↓
candidate type = GROCERY delivery
↓
same zone
↓
rank candidate
↓
offer
↓
assign

==================================================
RIDE ASSIGNMENT
==================================================

Ride:

customer books
↓
pickup coordinates
↓
pickup zone
↓
candidate type = RIDE
↓
online nearby drivers
↓
current zone = pickup zone
↓
Route Matrix to pickup
↓
offer ride
↓
driver accepts
↓
assign driver

==================================================
ATOMIC ACCEPTANCE
==================================================

Prevent two partners/drivers accepting the same job.

Use:

- database transaction
- row locking
- atomic status update
- existing queue/locking infrastructure if appropriate

The first valid acceptance wins.

Other offers must immediately become invalid/cancelled.

==================================================
OFFER TIMEOUT
==================================================

Make configurable.

Example:

15-20 seconds

If candidate:

- declines
- ignores
- goes offline
- becomes busy

continue to next candidate.

Do not permanently mark an order failed simply because first candidate declined.

==================================================
PART 9 — REALTIME EVENTS
==================================================

Inspect whether Laravel Reverb, Pusher or another WebSocket solution already exists.

REUSE existing infrastructure whenever possible.

If Laravel application has no suitable realtime system, integrate Laravel Reverb using the version-compatible approach.

Use authenticated private channels.

Conceptual channels:

private-order.{orderId}

private-ride.{rideId}

private-partner.{partnerId}

private-driver.{driverId}

private-vendor.{vendorId}

Actual naming should follow existing project conventions.

Possible events:

JobOffered
JobOfferExpired
JobAssigned
PartnerLocationUpdated
DriverLocationUpdated
OrderStatusUpdated
RideStatusUpdated
PartnerArrivedAtPickup
PartnerPickedUpOrder
DriverArrived
RideStarted
RideCompleted
DeliveryCompleted

Do not expose private customer/order data through public broadcast channels.

==================================================
PART 10 — CUSTOMER LIVE FOOD TRACKING
==================================================

After delivery partner assignment, customer must see:

- Google map
- restaurant marker
- customer marker
- delivery partner marker
- partner current live location
- route
- distance
- ETA
- order status
- relevant partner information

Before pickup:

PARTNER → RESTAURANT

route.

After pickup:

PARTNER/RESTAURANT → CUSTOMER

route.

Partner marker should move smoothly rather than jumping visually every few seconds.

Implement interpolation/animation between received coordinates.

==================================================
PART 11 — CUSTOMER LIVE GROCERY TRACKING
==================================================

Same tracking infrastructure.

Before pickup:

PARTNER → STORE

After pickup:

PARTNER → CUSTOMER

Do not create an unrelated second tracking system.

Reuse common tracking components.

==================================================
PART 12 — CUSTOMER RIDE TRACKING
==================================================

After driver accepts:

show:

- driver live location
- customer pickup
- destination
- route
- ETA to pickup
- driver information
- vehicle information
- ride state

Before ride starts:

DRIVER → PICKUP

After ride starts:

PICKUP/CURRENT DRIVER POSITION → DESTINATION

Update ETA appropriately.

==================================================
PART 13 — PARTNER-WEB MAP
==================================================

Implement complete maps functionality in partner-web.

For delivery:

Partner receives job
↓
map shows partner
↓
map shows restaurant/store
↓
route to pickup
↓
partner reaches pickup
↓
pickup confirmed
↓
map switches destination to customer
↓
route shown
↓
customer reached
↓
delivery completed

For ride:

driver receives ride request
↓
pickup shown
↓
route to customer
↓
driver arrives
↓
ride started
↓
destination shown
↓
route to destination
↓
ride completed

==================================================
EXTERNAL GOOGLE NAVIGATION
==================================================

Also provide a Start Navigation/Open in Google Maps option.

Use supported Google Maps URL approach such as:

https://www.google.com/maps/dir/?api=1&destination=LAT,LNG&travelmode=driving&dir_action=navigate

Generate values safely.

This can open external Google Maps navigation.

Embedded live tracking in our app and external turn-by-turn navigation are separate features.

==================================================
PART 14 — ROUTE REFRESH STRATEGY
==================================================

Do NOT call Compute Routes for every location event.

Use approximately:

initial assignment
+
route stage change
+
every ~20-30 seconds when necessary
+
significant deviation from existing route

Make interval configurable.

Marker itself should update from realtime coordinates every few seconds without making a Google Routes call.

Cache route responses briefly where useful.

==================================================
PART 15 — INTERNAL API DESIGN
==================================================

Inspect current API structure first.

Adapt rather than blindly adding these exact paths.

We need equivalent functionality to:

SUPER ADMIN

GET
/api/admin/integrations/google-maps

PATCH
/api/admin/integrations/google-maps

POST
/api/admin/integrations/google-maps/test

POST
/api/admin/integrations/google-maps/test-routes

POST
/api/admin/integrations/google-maps/test-geocoding


ZONES

GET
/api/admin/zones

POST
/api/admin/zones

GET
/api/admin/zones/{id}

PATCH
/api/admin/zones/{id}

DELETE
/api/admin/zones/{id}

POST
/api/admin/zones/{id}/status

POST
/api/admin/zones/validate


PUBLIC CONFIG

GET
/api/public/maps/config


SERVICEABILITY

GET
/api/serviceability/resolve?lat=&lng=&service=


LOCATION/ADDRESS

POST or GET appropriate endpoint for place autocomplete proxy if backend proxy is used

/api/maps/autocomplete

/api/maps/place/{placeId}

/api/maps/reverse-geocode

Do not proxy browser-capable Google requests through Laravel unnecessarily if current architecture can call them securely with browser-restricted key.

Server-restricted calls must go through Laravel.


TRACKING

POST
/api/partner/location

GET
/api/orders/{order}/tracking

GET
/api/rides/{ride}/tracking


PARTNER

POST
/api/partner/availability

GET
/api/partner/active-job

POST
/api/partner/jobs/{job}/accept

POST
/api/partner/jobs/{job}/decline

POST
/api/partner/jobs/{job}/arrived

POST
/api/partner/jobs/{job}/picked-up

POST
/api/partner/jobs/{job}/complete


RIDE

Use existing ride lifecycle endpoints if already present.

Do not create duplicate ride state APIs.

==================================================
PART 16 — LOCATION DATABASE DATA
==================================================

Ensure relevant address/location entities retain:

latitude
longitude
place_id where applicable
formatted_address
zone_id where applicable

Possible entities:

customer_addresses
vendors
restaurants
stores
partners
drivers
orders
rides
delivery jobs

Do not denormalize blindly.

At minimum store immutable order/ride pickup/drop coordinates on the transaction itself so historical orders do not change when a customer/vendor later edits an address.

==================================================
PART 17 — HISTORICAL LOCATION SNAPSHOT
==================================================

Food/grocery order should retain snapshot:

pickup_lat
pickup_lng
pickup_address

drop_lat
drop_lng
drop_address

pickup_zone_id
drop_zone_id

as appropriate.

Ride should retain:

pickup_lat
pickup_lng
pickup_address

destination_lat
destination_lng
destination_address

pickup_zone_id
destination_zone_id

where appropriate.

Do not rely only on mutable address table references for completed transactions.

==================================================
PART 18 — VENDOR-WEB
==================================================

Do not unnecessarily redesign vendor-web.

Only make changes required by maps/zones.

Where vendor edits restaurant/store location:

- Google address autocomplete
- map preview if appropriate
- coordinates
- service zone resolution
- show assigned service zone
- show "Outside service area" if invalid

Food restaurant can only operate where FOOD is supported.

Grocery store can only operate where GROCERY is supported.

Backend must enforce this regardless of frontend.

==================================================
PART 19 — SUPER ADMIN ZONES UI
==================================================

Build a professional UI consistent with existing `admin-web`.

Zone list should provide useful information such as:

- zone name
- city
- status
- enabled services
- restaurants count
- grocery stores count
- online food partners
- online grocery partners
- online drivers
- priority
- actions

Zone details/edit screen:

Left/side panel:
- name
- code
- description
- status
- services
- search radius
- cross-zone settings
- priority

Main area:
- Google Map
- polygon
- zone drawing/editing

Use existing design system.

Do not replace entire admin theme.

==================================================
PART 20 — ADMIN MAP INTEGRATION CARD UX
==================================================

Existing Google card should visually show:

Google Maps
Status: Connected / Not Configured / Error

Enabled APIs:
✓ Maps JavaScript
✓ Places
✓ Routes
✓ Geocoding
○ Roads

Browser Key:
••••••••••abcd

Server Key:
••••••••••wxyz

Buttons:
Edit
Test
Disable

Do not display full secrets after saving.

==================================================
PART 21 — FRONTEND COMMON MAP ARCHITECTURE
==================================================

Check whether apps share packages/modules.

If monorepo/shared packages exist, build common maps package.

Otherwise create a consistent architecture per app without risky monorepo restructuring.

Conceptual reusable components:

GoogleMap
LocationPicker
AddressAutocomplete
LiveTrackingMap
RoutePolyline
VehicleMarker
PickupMarker
DropMarker
ZonePolygon
ETAInfo
MapErrorBoundary

hooks:

useGoogleMaps
useCurrentLocation
useLiveTracking
useRoute
useAddressAutocomplete

Do not create unnecessary dependencies.

==================================================
PART 22 — GPS ERROR HANDLING
==================================================

Handle:

permission denied
GPS unavailable
timeout
poor accuracy
browser unsupported
partner backgrounded
network lost
WebSocket disconnected

Partner UI must clearly say location permission is required to go online/receive jobs where applicable.

Do not continue offering location-dependent jobs to a partner whose location is stale.

==================================================
PART 23 — CUSTOMER ERROR HANDLING
==================================================

Handle:

Google API failure
Map load failure
Places unavailable
Route unavailable
geolocation denied
outside service area
zone disabled
no driver available
no delivery partner available
location temporarily unavailable

Application must not crash because map provider fails.

==================================================
PART 24 — COST CONTROL
==================================================

Design for Google API cost efficiency.

Rules:

1. Do not call Routes per GPS tick.
2. Do not call Geocoding repeatedly for known coordinates.
3. Store Place IDs/coordinates appropriately.
4. Use FieldMask.
5. Query our database for vendors/partners.
6. Use Route Matrix only after narrowing candidates.
7. Cache relevant short-lived route/geocode results where safe.
8. Do not call Roads API continuously.
9. Use autocomplete session logic appropriately.
10. Make refresh intervals configurable.

==================================================
PART 25 — PERFORMANCE
==================================================

Do not write every 3-second GPS point permanently into an unlimited history table unless the existing product explicitly requires location history.

We need:

latest realtime position

plus optionally controlled tracking history if needed.

Recommended architecture:

fast latest-position storage:
Redis or efficient DB/cache

durable important milestones:
database

Optional historical telemetry:
retention policy

Do not create an infinitely growing location table with no retention policy.

==================================================
PART 26 — SECURITY
==================================================

Implement:

- authentication
- authorization
- private broadcasting
- request validation
- rate limits
- ownership validation
- API key encryption
- no secret logging
- service type validation
- zone validation
- IDOR protection
- spoofing controls where reasonably possible

A customer must only subscribe to their own order/ride.

A partner must only access jobs they are eligible for.

A vendor must only access their own orders.

Super Admin zone/integration endpoints must require correct permissions.

==================================================
PART 27 — LOCATION SPOOFING / SANITY CHECKS
==================================================

Do not blindly trust GPS data.

Add reasonable checks without breaking legitimate use:

- valid lat/lng range
- timestamp sanity
- impossible jump detection if appropriate
- speed sanity where appropriate
- accuracy metadata

Do not block legitimate GPS drift too aggressively.

Log suspicious telemetry separately rather than exposing security details to clients.

==================================================
PART 28 — RACE CONDITIONS
==================================================

Explicitly test:

two drivers accepting same ride
two partners accepting same order
partner becoming busy while receiving another offer
order cancelled while offer pending
ride cancelled while driver accepting
zone disabled during assignment
vendor becoming unavailable
customer cancelling before pickup
WebSocket event delivered late
duplicate location events

Make state transitions idempotent where possible.

==================================================
PART 29 — TESTING
==================================================

Add tests matching the project's existing testing style.

BACKEND tests:

Zone:
- create polygon
- resolve inside
- reject outside
- service disabled
- overlapping priority
- invalid geometry

Serviceability:
- food available
- grocery unavailable
- ride available

Assignment:
- food only → food partner
- grocery only → grocery partner
- ride only → driver
- wrong zone excluded
- offline excluded
- busy excluded
- stale GPS excluded
- farther partner vs lower road ETA
- acceptance race

Tracking:
- authorized subscriber
- unauthorized access rejected
- location update validation

Google integration:
- config encryption
- public API does not expose server key
- disabled provider handling


FRONTEND:

Test where infrastructure exists:

- maps disabled
- location selected
- out-of-zone
- map loading failure
- tracking update
- partner location update
- ride map stage transitions
- food map stage transitions
- grocery map stage transitions

==================================================
PART 30 — DO NOT BREAK EXISTING FLOWS
==================================================

Preserve:

- login
- registrations
- RBAC
- existing Admin modules
- vendor management
- menu/product management
- restaurant workflow
- grocery workflow
- customer cart
- checkout
- payments
- existing order states
- existing ride states
- notifications
- existing URLs where possible

If API contracts must change:

maintain backwards compatibility where practical.

==================================================
PART 31 — MIGRATION SAFETY
==================================================

Before migrations:

inspect existing schema.

Do not:

drop populated columns
rename critical columns without compatibility plan
destroy production records
reset database
run destructive seeders

Migrations must be incremental.

Use nullable/backfill strategy where necessary.

==================================================
PART 32 — MAP PROVIDER ABSTRACTION
==================================================

Do not tightly couple every business service to raw Google HTTP calls.

Use service interfaces/wrappers so future map provider replacement is possible.

Business logic should call methods conceptually like:

getRoute(...)
getRouteMatrix(...)
geocode(...)
reverseGeocode(...)
autocomplete(...)

instead of raw Google URLs throughout controllers.

==================================================
PART 33 — GOOGLE API FAILURE FALLBACK
==================================================

Job assignment must not completely collapse because Google Route Matrix temporarily fails.

Fallback candidate ranking:

zone
+
straight-line/geospatial distance

with clear logging.

Google routing improves ETA ranking but basic dispatch should still work during temporary Maps API failure where safe.

==================================================
PART 34 — ZONE + ASSIGNMENT RULES
==================================================

Final rules must be:

FOOD:

restaurant FOOD zone
=
delivery partner current FOOD zone

Customer must be serviceable under configured zone policy.

GROCERY:

store GROCERY zone
=
grocery partner current GROCERY zone

Customer must be serviceable under configured zone policy.

RIDE:

customer pickup RIDE zone
=
driver current RIDE zone

Destination handling follows zone configuration.

Once a partner/driver accepts a valid job:

do NOT cancel that active job just because they physically cross the zone boundary while performing it.

Zones control serviceability and assignment.

They must not interfere with an already valid active delivery/ride.

==================================================
PART 35 — SERVICE EXPANSION
==================================================

Make design extensible.

Do not hard-code architecture so deeply around exactly three services that another service becomes impossible.

Use service identifiers/enums/configuration appropriately.

Current services:

FOOD
GROCERY
RIDE

==================================================
PART 36 — UX REQUIREMENTS
==================================================

Customer tracking should feel similar in behavior to modern delivery/ride applications:

- map auto-fit
- smooth vehicle marker
- meaningful ETA
- pickup/drop markers
- current status
- route polyline
- reconnect indicator
- location freshness

Do not copy copyrighted UI/assets from Uber/Zomato/Blinkit.

Implement original UI consistent with our existing application.

==================================================
PART 37 — IMPLEMENTATION ORDER
==================================================

Work in this sequence:

STEP 1
Full repository audit.

STEP 2
Create a safe git checkpoint/branch if repository is under Git.

STEP 3
Map integration configuration backend.

STEP 4
Admin Google Maps Integration card.

STEP 5
Google Maps service layer.

STEP 6
Zones database and backend.

STEP 7
Super Admin Zones UI.

STEP 8
Vendor/store zone assignment.

STEP 9
Customer address + serviceability.

STEP 10
Partner GPS/location infrastructure.

STEP 11
Zone-aware candidate filtering.

STEP 12
Route Matrix ranking.

STEP 13
Atomic assignment workflow.

STEP 14
Realtime WebSocket events.

STEP 15
customer-web food tracking.

STEP 16
customer-web grocery tracking.

STEP 17
customer-web ride tracking.

STEP 18
partner-web pickup/drop maps.

STEP 19
External navigation.

STEP 20
Error handling/fallbacks.

STEP 21
Backend tests.

STEP 22
Frontend validation/build.

STEP 23
Run migrations safely.

STEP 24
Run Laravel tests.

STEP 25
Run PHP/static checks used by project.

STEP 26
Run React builds/lint/typecheck for every changed frontend.

STEP 27
Fix errors caused by this implementation.

==================================================
PART 38 — REQUIRED FINAL VERIFICATION
==================================================

Do not claim COMPLETE unless these scenarios work logically/code-wise.

SCENARIO A — FOOD

Customer in FOOD zone
→ sees serviceable restaurant
→ orders
→ restaurant processes order
→ nearby FOOD partner in same zone gets offer
→ accepts
→ sees restaurant on map
→ route to restaurant
→ picks up
→ customer sees partner moving live
→ partner sees customer
→ delivery completed


SCENARIO B — GROCERY

Customer in GROCERY zone
→ sees store
→ orders
→ store packs
→ nearby GROCERY partner in same zone gets offer
→ accepts
→ store navigation
→ pickup
→ live tracking
→ customer delivery


SCENARIO C — RIDE

Customer pickup in RIDE zone
→ chooses destination
→ nearby driver in same zone gets request
→ accepts
→ customer sees driver approaching live
→ driver sees pickup
→ driver arrives
→ ride starts
→ map route changes to destination
→ live ride tracking
→ ride completed


SCENARIO D — WRONG ZONE

Partner exists nearby physically but belongs/currently operates in another non-eligible zone

→ must not receive job.


SCENARIO E — WRONG SERVICE

Food delivery partner nearby

but request = RIDE

→ must not receive request.


SCENARIO F — MAP FAILURE

Google Routes unavailable

→ application should not crash
→ candidate fallback can use geospatial distance where appropriate
→ error logged safely.


SCENARIO G — SECURITY

Inspect network responses and ensure:

server Google Maps API key is NEVER exposed.

==================================================
PART 39 — FINAL REPORT FORMAT
==================================================

After implementation provide one complete report:

# GOOGLE MAPS + LIVE TRACKING + ZONES IMPLEMENTATION REPORT

## 1. Initial Architecture Found

## 2. Existing Functionality Reused

## 3. Problems Found

## 4. Database Changes

List every migration and table/column added.

## 5. Backend Changes

List every important file changed/created.

## 6. Admin-Web Changes

## 7. Customer-Web Changes

## 8. Partner-Web Changes

## 9. Vendor-Web Changes

## 10. Google Maps Integration

Show implemented Google services.

## 11. Zone System

Explain:
- polygon storage
- serviceability
- vendor assignment
- partner assignment

## 12. Food Flow

Explain final flow.

## 13. Grocery Flow

Explain final flow.

## 14. Ride Flow

Explain final flow.

## 15. Live Tracking

Explain:
GPS → Laravel → WebSocket → React

## 16. Job Assignment Algorithm

Explain exact filters/order.

## 17. API Endpoints

List all newly added/changed INTERNAL endpoints.

Separately list external Google endpoints used.

## 18. WebSocket Channels/Events

## 19. Security

## 20. Tests

List commands and exact results.

## 21. Build Results

backend
admin-web
customer-web
partner-web
vendor-web

## 22. Remaining Issues

Do not hide failures.

## 23. Manual Configuration Required

Tell me exactly:

- APIs I need to enable in Google Cloud
- where Browser API key goes
- where Server API key goes
- HTTP referrer restrictions
- server/IP restrictions
- any Reverb configuration required
- required queue workers
- required cron/scheduler
- required environment variables

## 24. How To Test

Give exact test sequence for:

Food
Grocery
Ride
Zones
Live tracking

==================================================
CRITICAL RULES
==================================================

1. Analyze before modifying.
2. Do not recreate working modules.
3. Do not reset database.
4. Do not expose server API key.
5. Do not put server API key into React.
6. Do not call Google Routes every GPS update.
7. Do not use Google Nearby Places to locate our own partners/vendors.
8. Do not use deprecated Google DrawingManager.
9. Do not assign jobs across incorrect service zones.
10. Do not assign wrong partner service type.
11. Do not allow duplicate job acceptance.
12. Do not trust frontend serviceability checks.
13. Laravel backend must enforce zone/serviceability rules.
14. Reuse existing coding patterns.
15. Use latest stable APIs compatible with installed versions.
16. Do not leave placeholder/mock implementation and call it complete.
17. Do not return fake successful test results.
18. If an existing implementation conflicts with this specification, preserve working behavior and refactor carefully.
19. If something already exists, improve/reuse it instead of implementing duplicates.
20. Complete implementation as far as repository/environment permits before producing the final report.

START NOW BY AUDITING THE COMPLETE REPOSITORY, THEN CONTINUE IMPLEMENTING THE SYSTEM.