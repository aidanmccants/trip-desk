// The proxy allow-list. `/api/<path>` is forwarded to https://api.tripsy.app/<path> only
// when method and path match an entry. `:name` segments match positive integers only.
// `fields` lists the writable top-level keys for JSON bodies; `nested` filters the keys of
// an object-valued field. Entries without `fields` forward no body.
import {
  ACTIVITY_FIELDS, CATEGORY_FIELDS, COLLABORATOR_PERMISSION_FIELDS, DOCUMENT_ATTACH_FIELDS,
  DOCUMENT_EDIT_FIELDS, EXPENSE_FIELDS, HOSTING_FIELDS, INBOX_EMAIL_FIELDS, INVITE_FIELDS,
  INVITE_PERMISSION_FIELDS, MOVE_FIELD, PROFILE_FIELDS, TRANSPORTATION_FIELDS, TRIP_CREATE_FIELDS,
  TRIP_FIELDS, UPLOAD_FIELDS,
} from './fields';

export type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface AllowedRoute {
  method: Method;
  pattern: string;
  fields?: readonly string[];
  nested?: Record<string, readonly string[]>;
}

const ITEM_KINDS = [
  ['hosting', 'hostings', HOSTING_FIELDS],
  ['activity', 'activities', ACTIVITY_FIELDS],
  ['transportation', 'transportations', TRANSPORTATION_FIELDS],
] as const;

const itemRoutes: AllowedRoute[] = ITEM_KINDS.flatMap(([one, many, fields]) => [
  { method: 'GET', pattern: `/v2/trip/:tripId/${many}` },
  { method: 'POST', pattern: `/v1/trip/:tripId/${many}`, fields },
  { method: 'GET', pattern: `/v2/trip/:tripId/${one}/:itemId` },
  { method: 'PATCH', pattern: `/v1/trip/:tripId/${one}/:itemId`, fields: [...fields, MOVE_FIELD] },
  { method: 'DELETE', pattern: `/v1/trip/:tripId/${one}/:itemId` },
  { method: 'GET', pattern: `/v2/trip/:tripId/${one}/:itemId/documents` },
  { method: 'GET', pattern: `/v2/trip/:tripId/${one}/:itemId/documents/:docId` },
  { method: 'POST', pattern: `/v1/trip/:tripId/${one}/:itemId/documents`, fields: DOCUMENT_ATTACH_FIELDS },
  { method: 'DELETE', pattern: `/v1/trip/:tripId/${one}/:itemId/documents/:docId` },
  { method: 'GET', pattern: `/v2/trip/:tripId/${one}/:itemId/emails` },
  { method: 'GET', pattern: `/v2/trip/:tripId/${one}/:itemId/emails/:emailId` },
]);

export const ALLOWED_ROUTES: AllowedRoute[] = [
  // Profile
  { method: 'GET', pattern: '/v1/me' },
  { method: 'PATCH', pattern: '/v1/me', fields: PROFILE_FIELDS },

  // Trips
  { method: 'GET', pattern: '/v2/trips' },
  { method: 'POST', pattern: '/v1/trips', fields: TRIP_CREATE_FIELDS },
  { method: 'GET', pattern: '/v1/trips/:tripId' },
  { method: 'PATCH', pattern: '/v1/trips/:tripId', fields: TRIP_FIELDS },
  { method: 'DELETE', pattern: '/v1/trips/:tripId' },

  // Hostings, activities, transportations and their documents/emails
  ...itemRoutes,

  // Expenses
  { method: 'GET', pattern: '/v1/trip/:tripId/expenses' },
  { method: 'POST', pattern: '/v1/trip/:tripId/expenses', fields: EXPENSE_FIELDS },
  { method: 'PATCH', pattern: '/v1/trip/:tripId/expense/:expenseId', fields: EXPENSE_FIELDS },
  { method: 'DELETE', pattern: '/v1/trip/:tripId/expense/:expenseId' },

  // Trip-level documents and booking emails
  { method: 'GET', pattern: '/v2/trip/:tripId/documents' },
  { method: 'GET', pattern: '/v2/trip/:tripId/documents/:docId' },
  { method: 'POST', pattern: '/v1/trip/:tripId/documents', fields: DOCUMENT_ATTACH_FIELDS },
  { method: 'DELETE', pattern: '/v1/trip/:tripId/documents/:docId' },
  { method: 'PATCH', pattern: '/v1/documents/:docId', fields: DOCUMENT_EDIT_FIELDS },
  { method: 'GET', pattern: '/v1/documents/:docId/get' },
  { method: 'GET', pattern: '/v2/trip/:tripId/emails' },
  { method: 'GET', pattern: '/v2/trip/:tripId/emails/:emailId' },

  // Uploads (presigned S3 PUT URLs)
  { method: 'POST', pattern: '/v1/storage/uploads', fields: UPLOAD_FIELDS },

  // People
  { method: 'GET', pattern: '/v1/trip/:tripId/collaborators' },
  {
    method: 'PATCH',
    pattern: '/v1/trip/:tripId/collaborator/:userId/permissions',
    fields: COLLABORATOR_PERMISSION_FIELDS,
  },
  { method: 'DELETE', pattern: '/v1/trip/:tripId/collaborator/:userId' },
  { method: 'GET', pattern: '/v1/guests/favorites' },
  {
    method: 'POST',
    pattern: '/v1/guests/invite',
    fields: INVITE_FIELDS,
    nested: { permissions: INVITE_PERMISSION_FIELDS },
  },

  // Custom categories
  { method: 'GET', pattern: '/v1/categories' },
  { method: 'POST', pattern: '/v1/categories', fields: CATEGORY_FIELDS },
  { method: 'PATCH', pattern: '/v1/categories/:catId', fields: CATEGORY_FIELDS },
  { method: 'DELETE', pattern: '/v1/categories/:catId' },

  // Booking-email inbox
  { method: 'GET', pattern: '/v1/automation/emails' },
  { method: 'GET', pattern: '/v1/automation/emails/:emailId' },
  { method: 'PATCH', pattern: '/v1/automation/emails/:emailId', fields: INBOX_EMAIL_FIELDS },
  { method: 'DELETE', pattern: '/v1/automation/emails/:emailId' },
];

/** Query parameters forwarded to Tripsy; anything else is dropped. */
export const ALLOWED_QUERY_PARAMS = [
  'page', 'updatedSince', 'fields', 'fields!', 'activityType', 'transportationType', 'deleted', 'since',
] as const;
