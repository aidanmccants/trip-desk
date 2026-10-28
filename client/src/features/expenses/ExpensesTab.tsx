import { useState } from 'react';
import { Lock, Plus, Receipt } from 'lucide-react';
import type { Expense, Trip } from '@shared/types';
import { useCategories, useExpenses, useItinerary, useMyPermissions } from '../../lib/queries';
import { fmtDay } from '../../lib/time';
import { Button, CategoryBadge, EmptyState, ErrorNotice, ListSkeleton, SectionCard, Skeleton } from '../../components/ui';
import { money } from '../../components/form';
import { ExpenseSheet } from './ExpenseSheet';
import { TotalCard } from './TotalCard';
import { buildLines, groupByDay } from './totals';

export function ExpensesTab({ trip }: { trip: Trip }) {
  const perms = useMyPermissions(trip.id);
  const expenses = useExpenses(trip.id, perms.canSeeExpenses);
  const itin = useItinerary(trip.id);
  const categories = useCategories();
  const [editing, setEditing] = useState<Expense | null>(null);
  const [creating, setCreating] = useState(false);

  if (!perms.canSeeExpenses) {
    return <EmptyState icon={Lock} title="You can't see this trip's expenses" message="Ask the trip owner for permission to see expenses." />;
  }
  if (expenses.error) return <ErrorNotice error={expenses.error} context="expenses" />;
  if (expenses.isLoading || itin.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-56 w-full rounded-card" />
        <ListSkeleton />
      </div>
    );
  }

  const lines = buildLines({
    tripTimezone: trip.timezone, expenses: expenses.data, hostings: itin.hostings,
    activities: itin.activities, transportations: itin.transportations, categories: categories.data,
  });
  const groups = groupByDay(lines);

  return (
    <div className="space-y-5">
      <ErrorNotice error={itin.error} />
      {lines.length > 0 && (
        <SectionCard title="Expenses">
          <TotalCard lines={lines} />
        </SectionCard>
      )}
      {perms.canEditExpenses && (
        <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>Add expense</Button>
      )}
      {lines.length === 0 && (
        <EmptyState icon={Receipt} title="No expenses yet" message="Standalone expenses and priced itinerary items show up here." />
      )}
      {groups.map((g) => (
        <section key={g.day || 'none'}>
          <h3 className="mb-1.5 px-1 text-footnote font-semibold uppercase tracking-wide text-label-3">
            {g.day ? fmtDay(g.day) : 'No date'}
          </h3>
          <div className="card divide-y divide-separator/40 overflow-hidden">
            {g.lines.map((l) => {
              const editable = l.source === 'expense' && perms.canEditExpenses;
              const body = (
                <>
                  <CategoryBadge icon={l.icon} color={l.color} />
                  <div className="min-w-0 flex-1 text-left">
                    <div className="truncate text-callout">{l.title}</div>
                    <div className="truncate text-footnote text-label-3">
                      {l.category}{l.source === 'item' && ' · from itinerary'}
                    </div>
                  </div>
                  <div className="text-callout font-medium tabular-nums">{money(l.amount, l.currency)}</div>
                </>
              );
              return editable ? (
                <button key={l.id} type="button" className="row w-full hover:bg-fill/10" onClick={() => setEditing(l.expense!)}>{body}</button>
              ) : (
                <div key={l.id} className="row">{body}</div>
              );
            })}
          </div>
        </section>
      ))}
      <ExpenseSheet trip={trip} open={creating} onClose={() => setCreating(false)} />
      <ExpenseSheet trip={trip} expense={editing} open={!!editing} onClose={() => setEditing(null)} />
    </div>
  );
}
