import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, RotateCcw, Trash2 } from 'lucide-react';
import { loadGoogleMaps } from '@/lib/googleMaps';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AdminZonePolygonPoint } from '@/typings/models';

interface ZonePolygonEditorProps {
  publicKey: string | null;
  center: { latitude: number; longitude: number } | null;
  value: AdminZonePolygonPoint[];
  onChange: (points: AdminZonePolygonPoint[]) => void;
  className?: string;
}

const DEFAULT_CENTER = { latitude: 28.6139, longitude: 77.209 };

function toLatLng(point: AdminZonePolygonPoint): google.maps.LatLngLiteral {
  return { lat: point.latitude, lng: point.longitude };
}

function serialize(points: AdminZonePolygonPoint[]): string {
  return JSON.stringify(points.map((p) => [Number(p.latitude.toFixed(6)), Number(p.longitude.toFixed(6))]));
}

function pathToPoints(path: google.maps.MVCArray<google.maps.LatLng>): AdminZonePolygonPoint[] {
  const points: AdminZonePolygonPoint[] = [];
  path.forEach((latLng: google.maps.LatLng) => {
    points.push({ latitude: latLng.lat(), longitude: latLng.lng() });
  });
  return points;
}

export function ZonePolygonEditor({ publicKey, center, value, onChange, className }: ZonePolygonEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const centerMarkerRef = useRef<google.maps.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const centerRef = useRef(center ?? DEFAULT_CENTER);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  onChangeRef.current = onChange;
  valueRef.current = value;
  centerRef.current = center ?? DEFAULT_CENTER;

  const init = useCallback(async () => {
    if (!publicKey || !containerRef.current) {
      setError('Google Maps browser key is not configured.');
      return;
    }

    try {
      await loadGoogleMaps(publicKey);
    } catch {
      setError('Could not load Google Maps. Check the browser key and network.');
      return;
    }

    if (!containerRef.current || mapRef.current) return;

    const mapCenter = centerRef.current;
    const map = new window.google.maps.Map(containerRef.current, {
      center: { lat: mapCenter.latitude, lng: mapCenter.longitude },
      zoom: 11,
      mapTypeControl: false,
      fullscreenControl: true,
      streetViewControl: false,
    });

    map.addListener('click', (e: google.maps.MapMouseEvent) => {
      const lat = e.latLng?.lat();
      const lng = e.latLng?.lng();
      if (lat == null || lng == null) return;
      onChangeRef.current([...valueRef.current, { latitude: lat, longitude: lng }]);
    });

    mapRef.current = map;
    centerMarkerRef.current = new window.google.maps.Marker({
      map,
      position: { lat: mapCenter.latitude, lng: mapCenter.longitude },
      draggable: true,
      title: 'Zone centre',
    });

    setReady(true);
  }, [publicKey]);

  useEffect(() => {
    void init();

    const container = containerRef.current;

    return () => {
      polygonRef.current?.setMap(null);
      polygonRef.current = null;
      centerMarkerRef.current?.setMap(null);
      centerMarkerRef.current = null;
      mapRef.current = null;
      if (container) container.innerHTML = '';
      setReady(false);
    };
  }, [init]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;

    const points = value;

    if (points.length < 3) {
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
        polygonRef.current = null;
      }
      return;
    }

    if (!polygonRef.current) {
      const polygon = new window.google.maps.Polygon({
        map: mapRef.current,
        paths: points.map(toLatLng),
        editable: true,
        draggable: true,
        strokeColor: '#4f46e5',
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: '#6366f1',
        fillOpacity: 0.18,
      });
      polygonRef.current = polygon;

      const syncFromMap = () => {
        if (!polygonRef.current) return;
        const next = pathToPoints(polygonRef.current.getPath());
        if (serialize(next) !== serialize(valueRef.current)) {
          onChangeRef.current(next);
        }
      };

      const path = polygon.getPath();
      path.addListener('set_at', syncFromMap);
      path.addListener('insert_at', syncFromMap);
      path.addListener('remove_at', syncFromMap);
      polygon.addListener('dragend', syncFromMap);
    } else if (serialize(points) !== serialize(pathToPoints(polygonRef.current.getPath()))) {
      polygonRef.current.setPath(points.map(toLatLng));
    }
  }, [ready, value]);

  const undo = () => onChange(value.slice(0, -1));
  const clear = () => onChange([]);

  const vertexCount = value.length;
  const valid = vertexCount >= 3;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative overflow-hidden rounded-xl border border-ink-100">
        <div ref={containerRef} className="h-80 w-full bg-neutral-100" />
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-neutral-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading map…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 px-6 text-center text-sm text-red-600">
            {error}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs text-neutral-500">
          <MapPin className="h-3.5 w-3.5" />
          Click the map to add boundary points, then drag vertices or edges to refine.
        </p>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-medium', valid ? 'text-emerald-600' : 'text-neutral-400')}>
            {vertexCount} point{vertexCount === 1 ? '' : 's'}
          </span>
          <Button type="button" size="sm" variant="ghost" disabled={vertexCount === 0} onClick={undo}>
            <RotateCcw className="h-3.5 w-3.5" /> Undo
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={vertexCount === 0} onClick={clear}>
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ZonePolygonEditor;
