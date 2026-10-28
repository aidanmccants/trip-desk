// Response shapes from Tripsy's Public API. Fields Tripsy may omit (price/currency when
// expenses are hidden, optional v2 extras) are optional.

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface SessionUser {
  sub: string;
  name: string;
  email: string | null;
}

export interface UserRef {
  id: number;
  name: string;
  email?: string;
  photo_url?: string | null;
}

export interface Profile {
  id: number;
  name: string;
  username: string;
  email: string;
  is_premium: boolean;
  premium_expiration_date: string | null;
  language: string;
  calendar_identifier?: string;
  calendar_emojis: boolean;
  calendar_hidden_categories: string | null;
  calendar_lodgings_all_day: boolean;
  calendar_trips_all_day: boolean;
  photo_url: string | null;
  timezone: string;
  default_currency: string;
  store_currency: string;
  anonymous_email_identifier?: string;
  notifications_flights_general_enabled: boolean;
  notifications_flights_departure_and_arrival: boolean;
  notifications_collaborators_new_activities_enabled: boolean;
}

export interface Trip {
  id: number;
  internal_identifier: string | null;
  name: string;
  timezone: string | null;
  hidden: boolean;
  description: string | null;
  /** YYYY-MM-DD, ignored when has_dates is false. */
  starts_at: string | null;
  ends_at: string | null;
  /** Index into the app's gradient palette (client/src/lib/gradients.ts). */
  cover_gradient: number | null;
  cover_image_url: string | null;
  owner: number;
  collaborators: number;
  has_dates: boolean;
  number_of_days: number;
  guests?: unknown[];
}

interface ItemBase {
  id: number;
  owner: UserRef;
  internal_identifier: string | null;
  trip: number;
  hidden: boolean;
  name: string;
  description: string | null;
  notes?: string | null;
  phone?: string | null;
  website?: string | null;
  price?: number | null;
  currency?: string | null;
  provider_reservation_code?: string | null;
  provider_reservation_description?: string | null;
  created_at: string;
  updated_at: string;
}

interface Located {
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  provider_location_url?: string | null;
  apple_maps_id?: string | null;
  google_places_id?: string | null;
}

export interface Hosting extends ItemBase, Located {
  /** UTC ISO-8601 check-in / check-out; local time is in `timezone`. */
  starts_at: string | null;
  ends_at: string | null;
  timezone: string | null;
  room_type?: string | null;
  room_number?: string | null;
}

export interface Activity extends ItemBase, Located {
  /** Built-in type or a custom category slug. */
  activity_type: string;
  period: string | null;
  starts_at: string | null;
  ends_at: string | null;
  all_day: boolean;
  checked: boolean;
  timezone: string | null;
}

export interface Transportation extends ItemBase {
  transportation_type: string;
  company?: string | null;
  transport_number?: string | null;
  actual_transport_number?: string | null;
  coach_number?: string | null;
  vehicle_description?: string | null;
  seat_number?: string | null;
  seat_class?: string | null;
  departure_description?: string | null;
  departure_at: string | null;
  departure_timezone: string | null;
  departure_address?: string | null;
  departure_latitude?: number | null;
  departure_longitude?: number | null;
  departure_terminal?: string | null;
  departure_gate?: string | null;
  departure_apple_maps_id?: string | null;
  arrival_description?: string | null;
  arrival_at: string | null;
  arrival_timezone: string | null;
  arrival_address?: string | null;
  arrival_latitude?: number | null;
  arrival_longitude?: number | null;
  arrival_terminal?: string | null;
  arrival_gate?: string | null;
  arrival_bags?: string | null;
  arrival_apple_maps_id?: string | null;
  flight_aware_identifier?: string | null;
  automatic_updates?: boolean;
  distance_meters?: number | null;
  provider_url?: string | null;
}

export type ItemKind = 'hosting' | 'activity' | 'transportation';
export type ItemOf<K extends ItemKind> = K extends 'hosting'
  ? Hosting
  : K extends 'activity'
    ? Activity
    : Transportation;
export type AnyItem = Hosting | Activity | Transportation;

/** Plural path segment used by Tripsy list routes. */
export const ITEM_PLURAL: Record<ItemKind, string> = {
  hosting: 'hostings',
  activity: 'activities',
  transportation: 'transportations',
};

export interface Expense {
  id: number;
  title: string;
  /** UTC datetime. */
  date: string;
  price: number;
  currency: string;
  owner: number;
  trip: number;
}

export interface CollaboratorPermissions {
  is_owner: boolean;
  can_edit: boolean;
  can_add_guests?: boolean;
  can_see_expenses: boolean;
  can_edit_expenses: boolean;
  can_see_documents?: boolean;
  can_edit_documents?: boolean;
  is_travelling: boolean;
  receive_notifications: boolean;
}

export interface Collaborator {
  /** User id. */
  id: number;
  name: string;
  email: string;
  photo_url: string | null;
  permissions: CollaboratorPermissions;
  /** false = pending invitation. */
  joined: boolean;
}

export interface Favorite {
  id: number;
  favorite_user: UserRef;
  automatic_suggest_on_new_trips: boolean;
  pending: boolean;
  inviter?: UserRef;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  owner: number;
  slug: string;
  name: string;
  icon_name: string;
  color: string;
}

/** Parent ids appear as numbers or `{ id }` objects; normalise with `refId`. */
export type ParentRef = number | { id: number };

/** Row from GET /v2/trip/{id}/documents (trip aggregate). */
export interface TripDocument {
  id: number;
  title: string;
  owner: number;
  created_at: string;
  file_type: string;
  temp_read_url?: string | null;
  activities: ParentRef[];
  hostings: ParentRef[];
  transportations: ParentRef[];
}

/** Document metadata (child lists, attach response). */
export interface DocumentMeta {
  id: number;
  created_at: string;
  title: string;
  description: string | null;
  owner: UserRef;
  file_type: string;
  url: string;
  thumb_url: string | null;
  favicon_url: string | null;
}

export interface DocumentDownload {
  download_url: string;
  file_type: string;
  title: string;
  expires_at: string | null;
}

export interface EmailAttachment {
  id: number;
  filename: string;
  payload: string | null;
  binary: boolean;
  mail_content_type: string;
  content_id: string | null;
  content_disposition: string | null;
}

export interface EmailSummary {
  id: number;
  unique_parser_identifier: string;
  date: string;
  subject: string;
  body_preview: string;
  attachments_count?: number;
  activities?: ParentRef[];
  hostings?: ParentRef[];
  transportations?: ParentRef[];
}

export interface EmailDetail extends EmailSummary {
  /** Untrusted HTML or text. Render only in a sandboxed iframe. */
  content: string;
  attachments: EmailAttachment[];
}

export interface UploadTicket {
  upload_url: string;
  method: 'PUT';
  headers: Record<string, string>;
  object_key: string;
  bucket: string;
  purpose: 'document' | 'profile_photo' | 'trip_cover';
  visibility: 'public' | 'private';
  expires_at: string;
  public_url?: string;
  upload_token?: string;
  content_length?: number;
}

export function refId(ref: ParentRef): number {
  return typeof ref === 'number' ? ref : ref.id;
}
