// Shared read hooks and query keys. Feature folders add their own mutations; every
// mutation invalidates the keys below on success (no optimistic updates in v1).
import { useQuery, type QueryClient } from '@tanstack/react-query';
import type {
  Activity, Category, Collaborator, Expense, Hosting, ItemKind, Profile, SessionUser,
  Transportation, Trip,
} from '@shared/types';
import { ITEM_PLURAL } from '@shared/types';
import { api, ApiError, fetchAll } from './api';

export const qk = {
  session: ['session'] as const,
  me: ['me'] as const,
  trips: ['trips'] as const,
  trip: (tripId: number) => ['trip', tripId] as const,
  /** Prefix for everything under one trip; invalidate this after moves. */
  tripAll: (tripId: number) => ['trip', tripId] as const,
  items: (tripId: number, kind: ItemKind) => ['trip', tripId, 'items', kind] as const,
  item: (tripId: number, kind: ItemKind, id: number) => ['trip', tripId, 'items', kind, id] as const,
  expenses: (tripId: number) => ['trip', tripId, 'expenses'] as const,
  collaborators: (tripId: number) => ['trip', tripId, 'collaborators'] as const,
  documents: (tripId: number) => ['trip', tripId, 'documents'] as const,
  itemDocuments: (tripId: number, kind: ItemKind, id: number) =>
    ['trip', tripId, 'documents', kind, id] as const,
  emails: (tripId: number) => ['trip', tripId, 'emails'] as const,
  itemEmails: (tripId: number, kind: ItemKind, id: number) =>
    ['trip', tripId, 'emails', kind, id] as const,
  favorites: ['favorites'] as const,
  categories: ['categories'] as const,
  inbox: ['inbox'] as const,
  inboxEmail: (id: number) => ['inbox', id] as const,
};

/** Signed-in user, or null when signed out. */
export function useSession() {
  return useQuery({
    queryKey: qk.session,
    queryFn: async () => {
      try {
        return (await api.get<{ user: SessionUser }>('/session')).user;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useMe() {
  return useQuery({ queryKey: qk.me, queryFn: () => api.get<Profile>('/v1/me'), staleTime: 60_000 });
}

export function useTrips() {
  return useQuery({ queryKey: qk.trips, queryFn: () => fetchAll<Trip>('/v2/trips') });
}

export function useTrip(tripId: number) {
  return useQuery({ queryKey: qk.trip(tripId), queryFn: () => api.get<Trip>(`/v1/trips/${tripId}`) });
}

export function useItems<K extends ItemKind>(tripId: number, kind: K) {
  return useQuery({
    queryKey: qk.items(tripId, kind),
    queryFn: () =>
      fetchAll<K extends 'hosting' ? Hosting : K extends 'activity' ? Activity : Transportation>(
        `/v2/trip/${tripId}/${ITEM_PLURAL[kind]}`,
      ),
  });
}

/** All three itinerary lists for a trip. */
export function useItinerary(tripId: number) {
  const hostings = useItems(tripId, 'hosting');
  const activities = useItems(tripId, 'activity');
  const transportations = useItems(tripId, 'transportation');
  return {
    hostings: hostings.data ?? [],
    activities: activities.data ?? [],
    transportations: transportations.data ?? [],
    isLoading: hostings.isLoading || activities.isLoading || transportations.isLoading,
    error: hostings.error ?? activities.error ?? transportations.error,
  };
}

export function useExpenses(tripId: number, enabled = true) {
  return useQuery({
    queryKey: qk.expenses(tripId),
    queryFn: () => fetchAll<Expense>(`/v1/trip/${tripId}/expenses`),
    enabled,
    retry: (n, e) => !(e instanceof ApiError && e.status === 403) && n < 2,
  });
}

export function useCollaborators(tripId: number) {
  return useQuery({
    queryKey: qk.collaborators(tripId),
    queryFn: () => fetchAll<Collaborator>(`/v1/trip/${tripId}/collaborators`),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: qk.categories,
    queryFn: async () => (await api.get<{ results: Category[] }>('/v1/categories')).results,
    staleTime: 5 * 60_000,
  });
}

export interface MyPermissions {
  isOwner: boolean;
  canEdit: boolean;
  canAddGuests: boolean;
  canSeeExpenses: boolean;
  canEditExpenses: boolean;
  canSeeDocuments: boolean;
  canEditDocuments: boolean;
}

/**
 * The current user's permissions on a trip, read from /collaborators. Until that loads
 * (or if the user isn't listed) the owner gets everything and others get read-only.
 */
export function useMyPermissions(tripId: number): MyPermissions {
  const me = useMe();
  const trip = useTrip(tripId);
  const collabs = useCollaborators(tripId);
  const mine = collabs.data?.find((c) => c.id === me.data?.id)?.permissions;
  const isOwner = mine?.is_owner ?? (!!me.data && trip.data?.owner === me.data.id);
  if (isOwner) {
    return {
      isOwner: true, canEdit: true, canAddGuests: true, canSeeExpenses: true,
      canEditExpenses: true, canSeeDocuments: true, canEditDocuments: true,
    };
  }
  return {
    isOwner: false,
    canEdit: !!mine?.can_edit,
    canAddGuests: !!mine?.can_add_guests,
    canSeeExpenses: !!mine?.can_see_expenses,
    canEditExpenses: !!mine?.can_edit_expenses,
    canSeeDocuments: mine?.can_see_documents ?? !!mine,
    canEditDocuments: !!mine?.can_edit_documents,
  };
}

/** Invalidate everything belonging to a trip plus the trip list. */
export function invalidateTrip(qc: QueryClient, tripId: number) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: qk.tripAll(tripId) }),
    qc.invalidateQueries({ queryKey: qk.trips }),
  ]);
}
