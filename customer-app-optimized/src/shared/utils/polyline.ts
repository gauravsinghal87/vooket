/** Decode/encode Google encoded polyline strings. */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export function decodePolyline(encoded: string | null | undefined): LatLng[] {
  if (!encoded) return [];

  const points: LatLng[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return points;
}

export function encodePolyline(points: LatLng[]): string {
  if (points.length === 0) return '';
  const chr = (x: number) => String.fromCharCode(x);

  const round = (v: number) => Math.round(v * 1e5);
  let lastLat = 0;
  let lastLng = 0;
  let encoded = '';

  for (const point of points) {
    const lat = round(point.latitude);
    const lng = round(point.longitude);
    const dlat = lat - lastLat;
    const dlng = lng - lastLng;
    lastLat = lat;
    lastLng = lng;

    encoded += encodeValue(dlat);
    encoded += encodeValue(dlng);
  }

  function encodeValue(v: number): string {
    let sv = v < 0 ? ~(v << 1) : v << 1;
    let out = '';
    while (sv >= 0x20) {
      out += chr((0x20 | (sv & 0x1f)) + 63);
      sv >>= 5;
    }
    out += chr(sv + 63);
    return out;
  }

  return encoded;
}