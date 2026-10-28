import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { Trip } from '@shared/types';
import { useCategories, useExpenses, useItinerary, useMyPermissions } from '../../lib/queries';
import { IconButton, SectionCard } from '../../components/ui';
import { TotalCard } from './TotalCard';
import { buildLines } from './totals';

const KEY = 'tripdesk.hideExpenses';
const readHidden = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

/** Compact "Total in USD" card for the Overview tab. */
export function ExpenseSummaryCard({ trip }: { trip: Trip }) {
  const perms = useMyPermissions(trip.id);
  const expenses = useExpenses(trip.id, perms.canSeeExpenses);
  const itin = useItinerary(trip.id);
  const categories = useCategories();
  const [hidden, setHidden] = useState(readHidden);
  if (!perms.canSeeExpenses) return null;
  const lines = buildLines({
    tripTimezone: trip.timezone, expenses: expenses.data, hostings: itin.hostings,
    activities: itin.activities, transportations: itin.transportations, categories: categories.data,
  });
  if (lines.length === 0) return null;
  const toggle = () => {
    const next = !hidden;
    setHidden(next);
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      /* storage unavailable */
    }
  };
  return (
    <SectionCard
      title="Expenses"
      action={<IconButton icon={hidden ? EyeOff : Eye} label={hidden ? 'Show amounts' : 'Hide amounts'} onClick={toggle} />}
    >
      <TotalCard lines={lines} limit={4} hidden={hidden} />
    </SectionCard>
  );
}
