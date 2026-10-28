import { describe, expect, it } from 'vitest';
import type { Activity, Expense, Hosting, Transportation } from '@shared/types';
import { buildLines, byCategory, groupByDay, totalsByCurrency } from './totals';

const base = { owner: { id: 1, name: 'a' }, internal_identifier: null, trip: 1, hidden: false, description: null, created_at: '', updated_at: '' };
const exp = (id: number, price: number, currency: string, date: string): Expense => ({ id, title: `e${id}`, date, price, currency, owner: 1, trip: 1 });
const hosting = { ...base, id: 1, name: 'Hotel', price: 300, currency: 'EUR', starts_at: '2026-09-15T20:00:00Z', ends_at: null, timezone: 'Europe/Rome' } as Hosting;
const flight = { ...base, id: 2, name: 'Flight', transportation_type: 'airplane', price: 500, currency: 'USD', departure_at: '2026-09-14T10:00:00Z', departure_timezone: 'UTC', arrival_at: null, arrival_timezone: null } as Transportation;
const free = { ...base, id: 3, name: 'Walk', activity_type: 'tour', price: null, starts_at: null, ends_at: null, all_day: false, checked: false, period: null, timezone: null } as Activity;

describe('totals', () => {
  const lines = buildLines({
    tripTimezone: 'America/New_York',
    expenses: [exp(1, 50, 'USD', '2026-09-15T03:00:00Z'), exp(2, 20, 'EUR', '2026-09-15T15:00:00Z')],
    hostings: [hosting], transportations: [flight], activities: [free],
  });
  it('skips unpriced items and uses trip tz for expenses', () => {
    expect(lines).toHaveLength(4);
    expect(lines.find((l) => l.id === 'expense-1')?.day).toBe('2026-09-14');
    expect(lines.find((l) => l.id === 'hosting-1')?.day).toBe('2026-09-15');
  });
  it('totals by currency sorted desc', () => {
    expect(totalsByCurrency(lines)).toEqual([{ currency: 'USD', total: 550 }, { currency: 'EUR', total: 320 }]);
  });
  it('groups by category', () => {
    const c = byCategory(lines, 'USD');
    expect(c.map((x) => [x.label, x.total])).toEqual([['Flight', 500], ['Expense', 50]]);
  });
  it('groups by day newest first', () => {
    expect(groupByDay(lines).map((g) => g.day)).toEqual(['2026-09-15', '2026-09-14']);
  });
});
