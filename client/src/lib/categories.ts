// Visual metadata (label, Lucide icon, color) for itinerary items. Tripsy's docs only
// confirm `tour`, `restaurant` (activities) and `airplane` (transportation); the other
// built-ins below are best guesses. Pickers also offer any type already used on the
// trip and the user's custom categories (GET /v1/categories).
import {
  BedDouble, Bike, Bus, CalendarDays, Car, Coffee, Croissant, Dumbbell, Footprints, Landmark,
  MapPin, Martini, Mountain, Music, Plane, Sailboat, Ship, ShoppingBag, Sparkles, Star, Ticket,
  Train, TramFront, TreePalm, Utensils, type LucideIcon,
} from 'lucide-react';
import type { AnyItem, Category, ItemKind } from '@shared/types';

export interface CategoryMeta {
  value: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

export const ACTIVITY_TYPES: CategoryMeta[] = [
  { value: 'tour', label: 'Tour', icon: Footprints, color: '#F5225A' },
  { value: 'restaurant', label: 'Restaurant', icon: Utensils, color: '#FF8A00' },
  { value: 'cafe', label: 'Café', icon: Coffee, color: '#B8743A' },
  { value: 'bakery', label: 'Bakery', icon: Croissant, color: '#D97706' },
  { value: 'bar', label: 'Bar & Party', icon: Martini, color: '#F59E0B' },
  { value: 'museum', label: 'Museum', icon: Landmark, color: '#E5197E' },
  { value: 'shopping', label: 'Shopping', icon: ShoppingBag, color: '#F8B500' },
  { value: 'music', label: 'Music', icon: Music, color: '#E11D48' },
  { value: 'event', label: 'Event', icon: Ticket, color: '#8B5CF6' },
  { value: 'nature', label: 'Nature', icon: Mountain, color: '#30B651' },
  { value: 'beach', label: 'Beach', icon: TreePalm, color: '#06B6D4' },
  { value: 'sport', label: 'Sport', icon: Dumbbell, color: '#10B981' },
  { value: 'place', label: 'Place', icon: MapPin, color: '#F5225A' },
];

export const TRANSPORTATION_TYPES: CategoryMeta[] = [
  { value: 'airplane', label: 'Flight', icon: Plane, color: '#1E9BF5' },
  { value: 'train', label: 'Train', icon: Train, color: '#2F6BFF' },
  { value: 'bus', label: 'Bus', icon: Bus, color: '#2F6BFF' },
  { value: 'car', label: 'Car', icon: Car, color: '#2F6BFF' },
  { value: 'taxi', label: 'Taxi', icon: Car, color: '#2F6BFF' },
  { value: 'subway', label: 'Subway', icon: TramFront, color: '#2F6BFF' },
  { value: 'ferry', label: 'Ferry', icon: Ship, color: '#0EA5E9' },
  { value: 'cruise', label: 'Cruise', icon: Sailboat, color: '#0EA5E9' },
  { value: 'bicycle', label: 'Bicycle', icon: Bike, color: '#30B651' },
  { value: 'walk', label: 'Walk', icon: Footprints, color: '#30B651' },
];

export const LODGING_META: CategoryMeta = { value: 'hosting', label: 'Lodging', icon: BedDouble, color: '#C03CF0' };
export const ITINERARY_META: CategoryMeta = { value: 'itinerary', label: 'Itinerary', icon: CalendarDays, color: '#F97316' };

const titleCase = (s: string) => s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Meta for an activity type, resolving custom category slugs. */
export function activityMeta(type: string, categories: Category[] = []): CategoryMeta {
  const builtIn = ACTIVITY_TYPES.find((t) => t.value === type);
  if (builtIn) return builtIn;
  const custom = categories.find((c) => c.slug === type);
  if (custom) return { value: custom.slug, label: custom.name, icon: Star, color: custom.color || '#8E8E93' };
  return { value: type, label: titleCase(type || 'Activity'), icon: Sparkles, color: '#8E8E93' };
}

export function transportationMeta(type: string): CategoryMeta {
  return (
    TRANSPORTATION_TYPES.find((t) => t.value === type) ?? {
      value: type, label: titleCase(type || 'Transport'), icon: Car, color: '#2F6BFF',
    }
  );
}

export function itemMeta(kind: ItemKind, item: AnyItem, categories: Category[] = []): CategoryMeta {
  if (kind === 'hosting') return LODGING_META;
  if (kind === 'activity') return activityMeta((item as { activity_type: string }).activity_type, categories);
  return transportationMeta((item as { transportation_type: string }).transportation_type);
}

/** Options for the activity-type picker: built-ins, custom categories, and types seen on the trip. */
export function activityTypeOptions(categories: Category[], seen: string[]): CategoryMeta[] {
  const out = [...ACTIVITY_TYPES];
  for (const c of categories) if (!out.some((o) => o.value === c.slug)) out.push(activityMeta(c.slug, categories));
  for (const s of seen) if (s && !out.some((o) => o.value === s)) out.push(activityMeta(s, categories));
  return out;
}

export function transportationTypeOptions(seen: string[]): CategoryMeta[] {
  const out = [...TRANSPORTATION_TYPES];
  for (const s of seen) if (s && !out.some((o) => o.value === s)) out.push(transportationMeta(s));
  return out;
}
