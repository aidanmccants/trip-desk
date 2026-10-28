// maplibre-gl map with OSM raster tiles. Import via LazyMap so maplibre stays out of the main bundle.
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  color: string;
  label?: string;
  onClick?: () => void;
}

export interface MapViewProps {
  markers: MapMarker[];
  /** Each line is [[lng,lat],[lng,lat]]. */
  lines?: [[number, number], [number, number]][];
  interactive?: boolean;
  className?: string;
  /** When this marker id changes, the map flies to it. */
  focusId?: string | null;
}

const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

function markerEl(m: MapMarker): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = `width:26px;height:26px;border-radius:9999px;background:${m.color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);color:#fff;font:600 12px/22px system-ui,sans-serif;text-align:center;${m.onClick ? 'cursor:pointer;' : ''}`;
  el.textContent = m.label ?? '';
  return el;
}

export default function MapView({ markers, lines = [], interactive = true, className, focusId }: MapViewProps) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const live = useRef<{ id: string; mk: maplibregl.Marker }[]>([]);
  const ready = useRef(false);
  const latest = useRef({ markers, lines });
  latest.current = { markers, lines };

  const sync = () => {
    const m = map.current;
    if (!m || !ready.current) return;
    const { markers: ms, lines: ls } = latest.current;
    live.current.forEach((x) => x.mk.remove());
    live.current = ms.map((mk) => {
      const el = markerEl(mk);
      if (mk.onClick) el.addEventListener('click', (e) => { e.stopPropagation(); mk.onClick?.(); });
      return { id: mk.id, mk: new maplibregl.Marker({ element: el }).setLngLat([mk.lng, mk.lat]).addTo(m) };
    });
    const src = m.getSource('lines') as maplibregl.GeoJSONSource | undefined;
    src?.setData({
      type: 'FeatureCollection',
      features: ls.map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: c } })),
    });
  };

  const fit = (animate: boolean) => {
    const m = map.current;
    const { markers: ms } = latest.current;
    if (!m || !ms.length) return;
    if (ms.length === 1) {
      m.jumpTo({ center: [ms[0].lng, ms[0].lat], zoom: 12 });
      return;
    }
    const b = new maplibregl.LngLatBounds();
    ms.forEach((x) => b.extend([x.lng, x.lat]));
    m.fitBounds(b, { padding: 48, maxZoom: 14, animate, duration: 400 });
  };

  useEffect(() => {
    if (!box.current) return;
    const m = new maplibregl.Map({
      container: box.current,
      style: STYLE,
      center: [0, 20],
      zoom: 1,
      interactive,
      attributionControl: interactive ? { compact: true } : false,
    });
    map.current = m;
    if (interactive) m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.on('load', () => {
      m.addSource('lines', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({
        id: 'lines', type: 'line', source: 'lines',
        paint: { 'line-color': '#1E9BF5', 'line-width': 2.5, 'line-dasharray': [2, 2] },
      });
      ready.current = true;
      sync();
      fit(false);
    });
    return () => {
      ready.current = false;
      live.current = [];
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive]);

  const sig = JSON.stringify([markers.map((m) => [m.id, m.lat, m.lng, m.color, m.label]), lines]);
  useEffect(() => {
    sync();
    fit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  useEffect(() => {
    if (!focusId) return;
    const t = latest.current.markers.find((m) => m.id === focusId);
    if (t) map.current?.flyTo({ center: [t.lng, t.lat], zoom: Math.max(map.current.getZoom(), 14) });
  }, [focusId]);

  return <div ref={box} className={className} />;
}
