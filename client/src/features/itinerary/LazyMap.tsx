import { lazy, Suspense } from 'react';
import { Skeleton } from '../../components/ui';
import type { MapViewProps } from './MapView';

export type { MapMarker } from './MapView';
const MapView = lazy(() => import('./MapView'));

/** Lazy maplibre map; keeps maplibre-gl out of the main bundle. */
export function LazyMap(props: MapViewProps) {
  return (
    <Suspense fallback={<Skeleton className={props.className ?? 'h-48 w-full'} />}>
      <MapView {...props} />
    </Suspense>
  );
}
