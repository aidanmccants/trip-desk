// Tripsy's writable fields per resource (docs.api.tripsy.app). The Worker drops any
// other key on writes, and client form payloads are typed from these lists.

export const TRIP_FIELDS = [
  'name', 'description', 'timezone', 'hidden', 'has_dates', 'starts_at', 'ends_at',
  'number_of_days', 'cover_gradient', 'cover_image_url', 'internal_identifier',
] as const;
export const TRIP_CREATE_FIELDS = [...TRIP_FIELDS, 'guest_invites'] as const;

export const HOSTING_FIELDS = [
  'name', 'description', 'starts_at', 'ends_at', 'timezone', 'address', 'latitude', 'longitude',
  'phone', 'website', 'room_type', 'room_number', 'notes', 'price', 'currency',
  'provider_location_url', 'provider_reservation_code', 'provider_reservation_description',
  'apple_maps_id', 'google_places_id', 'hidden', 'internal_identifier',
] as const;

export const ACTIVITY_FIELDS = [
  'name', 'activity_type', 'description', 'period', 'starts_at', 'ends_at', 'all_day', 'timezone',
  'checked', 'address', 'latitude', 'longitude', 'phone', 'website', 'notes', 'price', 'currency',
  'provider_location_url', 'provider_reservation_code', 'provider_reservation_description',
  'apple_maps_id', 'google_places_id', 'hidden', 'internal_identifier',
] as const;

export const TRANSPORTATION_FIELDS = [
  'name', 'transportation_type', 'description', 'notes', 'company', 'transport_number',
  'actual_transport_number', 'coach_number', 'vehicle_description', 'seat_number', 'seat_class',
  'departure_description', 'departure_at', 'departure_timezone', 'departure_address',
  'departure_latitude', 'departure_longitude', 'departure_terminal', 'departure_gate',
  'departure_apple_maps_id', 'arrival_description', 'arrival_at', 'arrival_timezone',
  'arrival_address', 'arrival_latitude', 'arrival_longitude', 'arrival_terminal', 'arrival_gate',
  'arrival_bags', 'phone', 'website', 'flight_aware_identifier', 'automatic_updates',
  'distance_meters', 'price', 'currency', 'provider_url', 'provider_reservation_code',
  'provider_reservation_description', 'hidden', 'internal_identifier',
] as const;

/** Itinerary updates may also carry `update_trip` to move the item to another trip. */
export const MOVE_FIELD = 'update_trip' as const;

export const EXPENSE_FIELDS = ['title', 'date', 'price', 'currency'] as const;

export const DOCUMENT_ATTACH_FIELDS = [
  'url', 'file_type', 'title', 'description', 'thumb_url', 'favicon_url', 'upload_token',
] as const;
export const DOCUMENT_EDIT_FIELDS = [
  'title', 'description', 'thumb_url', 'favicon_url',
  'trip_id', 'activity_id', 'hosting_id', 'transportation_id',
] as const;

export const COLLABORATOR_PERMISSION_FIELDS = [
  'can_edit', 'can_add_guests', 'can_see_expenses', 'can_edit_expenses', 'can_see_documents',
  'can_edit_documents', 'is_travelling', 'receive_notifications',
] as const;

export const INVITE_FIELDS = ['trip_id', 'invited_user_email', 'permissions'] as const;
export const INVITE_PERMISSION_FIELDS = [
  'read_only', 'can_add_guests', 'can_see_expenses', 'can_edit_expenses', 'can_see_documents',
  'can_edit_documents', 'is_travelling', 'title',
] as const;

export const CATEGORY_FIELDS = ['name', 'slug', 'icon_name', 'color'] as const;

export const INBOX_EMAIL_FIELDS = [
  'subject', 'trip_id', 'activity_id', 'hosting_id', 'transportation_id',
] as const;

export const PROFILE_FIELDS = [
  'name', 'username', 'email', 'photo_url', 'language', 'timezone', 'default_currency',
  'store_currency', 'calendar_emojis', 'calendar_hidden_categories', 'calendar_lodgings_all_day',
  'calendar_trips_all_day', 'notifications_flights_general_enabled',
  'notifications_flights_departure_and_arrival',
  'notifications_collaborators_new_activities_enabled',
] as const;

export const UPLOAD_FIELDS = [
  'purpose', 'filename', 'content_type', 'content_length', 'visibility', 'parent_type', 'parent_id',
] as const;

/** A field list as a TypeScript key union. */
export type FieldOf<T extends readonly string[]> = T[number];
