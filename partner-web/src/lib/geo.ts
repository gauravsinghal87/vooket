const GEOLOCATION_ERRORS: Record<number, string> = {
  1: 'Location permission denied. Please allow location access in your browser and try again.',
  2: 'Your location could not be determined. Please try again.',
  3: 'Location request timed out. Please try again.',
};

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export function getCurrentPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location services are not supported on this device.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(new Error(GEOLOCATION_ERRORS[err.code] ?? 'Could not get your location.')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  });
}