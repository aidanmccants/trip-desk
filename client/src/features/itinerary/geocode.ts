// Address search via OpenStreetMap Nominatim. Failures resolve to an empty list.
export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

export async function geocode(query: string): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[];
    return rows
      .map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }))
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
  } catch {
    return [];
  }
}

export const googleMapsUrl = (lat: number | null | undefined, lng: number | null | undefined, address?: string | null): string | null => {
  if (lat != null && lng != null) return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  if (address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return null;
};
