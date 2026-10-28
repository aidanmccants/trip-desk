// Select for choosing where a document or email goes: the trip itself or one item.
import { useMemo } from 'react';
import { itemMeta } from '../../lib/categories';
import { useCategories, useItinerary } from '../../lib/queries';
import { Field, Select } from '../../components/ui';
import { parentKey, type Parent } from './docs';

export function ParentPicker({ tripId, value, onChange, label = 'Attach to', tripLabel = 'Whole trip', allowTrip = true }: {
  tripId: number;
  value: Parent | null;
  onChange: (p: Parent | null) => void;
  label?: string;
  tripLabel?: string;
  allowTrip?: boolean;
}) {
  const { hostings, activities, transportations } = useItinerary(tripId);
  const cats = useCategories();
  const options = useMemo(() => {
    const cs = cats.data ?? [];
    return {
      hosting: hostings.map((i) => ({ id: i.id, name: i.name || itemMeta('hosting', i, cs).label })),
      activity: activities.map((i) => ({ id: i.id, name: i.name || itemMeta('activity', i, cs).label })),
      transportation: transportations.map((i) => ({ id: i.id, name: i.name || itemMeta('transportation', i, cs).label })),
    };
  }, [hostings, activities, transportations, cats.data]);

  const decode = (v: string): Parent | null => {
    if (!v) return null;
    if (v === 'trip') return { kind: 'trip', id: tripId };
    const [kind, id] = v.split(':');
    return { kind: kind as Parent['kind'], id: Number(id) };
  };

  return (
    <Field label={label}>
      <Select value={value ? (value.kind === 'trip' ? 'trip' : parentKey(value)) : ''} onChange={(e) => onChange(decode(e.target.value))}>
        {!allowTrip && <option value="">Choose…</option>}
        {allowTrip && <option value="trip">{tripLabel}</option>}
        {options.hosting.length > 0 && (
          <optgroup label="Lodging">{options.hosting.map((i) => <option key={i.id} value={`hosting:${i.id}`}>{i.name}</option>)}</optgroup>
        )}
        {options.activity.length > 0 && (
          <optgroup label="Activities">{options.activity.map((i) => <option key={i.id} value={`activity:${i.id}`}>{i.name}</option>)}</optgroup>
        )}
        {options.transportation.length > 0 && (
          <optgroup label="Transportation">{options.transportation.map((i) => <option key={i.id} value={`transportation:${i.id}`}>{i.name}</option>)}</optgroup>
        )}
      </Select>
    </Field>
  );
}
