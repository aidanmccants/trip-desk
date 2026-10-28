// Pure helpers that merge standalone expenses with priced itinerary items.
import { Receipt, type LucideIcon } from 'lucide-react';
import type { Activity, Category, Expense, Hosting, ItemKind, Transportation } from '@shared/types';
import { itemMeta } from '../../lib/categories';
import { localDay } from '../../lib/time';

export interface ExpenseLine {
  id: string;
  source: 'expense' | 'item';
  kind?: ItemKind;
  /** Set for standalone expenses so the row can open the editor. */
  expense?: Expense;
  title: string;
  amount: number;
  currency: string;
  /** YYYY-MM-DD local day, or '' when unknown. */
  day: string;
  category: string;
  color: string;
  icon: LucideIcon;
}

export const EXPENSE_COLOR = '#8E8E93';

export interface BuildInput {
  tripTimezone: string | null | undefined;
  expenses?: Expense[];
  hostings?: Hosting[];
  activities?: Activity[];
  transportations?: Transportation[];
  categories?: Category[];
}

const priced = (price: number | null | undefined): price is number =>
  typeof price === 'number' && Number.isFinite(price) && price > 0;

export function buildLines(input: BuildInput): ExpenseLine[] {
  const { tripTimezone, categories = [] } = input;
  const out: ExpenseLine[] = [];
  for (const e of input.expenses ?? []) {
    if (!priced(e.price)) continue;
    out.push({
      id: `expense-${e.id}`, source: 'expense', expense: e, title: e.title, amount: e.price,
      currency: e.currency || 'USD', day: e.date ? localDay(e.date, tripTimezone) : '',
      category: 'Expense', color: EXPENSE_COLOR, icon: Receipt,
    });
  }
  const add = (kind: ItemKind, item: Hosting | Activity | Transportation, at: string | null, tz: string | null) => {
    if (!priced(item.price)) return;
    const meta = itemMeta(kind, item, categories);
    out.push({
      id: `${kind}-${item.id}`, source: 'item', kind, title: item.name, amount: item.price,
      currency: item.currency || 'USD', day: at ? localDay(at, tz || tripTimezone) : '',
      category: meta.label, color: meta.color, icon: meta.icon,
    });
  };
  for (const h of input.hostings ?? []) add('hosting', h, h.starts_at, h.timezone);
  for (const a of input.activities ?? []) add('activity', a, a.starts_at, a.timezone);
  for (const t of input.transportations ?? []) add('transportation', t, t.departure_at, t.departure_timezone);
  return out;
}

export function totalsByCurrency(lines: ExpenseLine[]): { currency: string; total: number }[] {
  const m = new Map<string, number>();
  for (const l of lines) m.set(l.currency, (m.get(l.currency) ?? 0) + l.amount);
  return [...m.entries()].map(([currency, total]) => ({ currency, total })).sort((a, b) => b.total - a.total);
}

export function byCategory(lines: ExpenseLine[], currency: string): { label: string; color: string; icon: LucideIcon; total: number }[] {
  const m = new Map<string, { label: string; color: string; icon: LucideIcon; total: number }>();
  for (const l of lines) {
    if (l.currency !== currency) continue;
    const cur = m.get(l.category);
    if (cur) cur.total += l.amount;
    else m.set(l.category, { label: l.category, color: l.color, icon: l.icon, total: l.amount });
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

/** Groups by day, newest day first; undated lines go last under ''. */
export function groupByDay(lines: ExpenseLine[]): { day: string; lines: ExpenseLine[] }[] {
  const m = new Map<string, ExpenseLine[]>();
  for (const l of lines) m.set(l.day, [...(m.get(l.day) ?? []), l]);
  return [...m.entries()]
    .map(([day, ls]) => ({ day, lines: ls }))
    .sort((a, b) => (a.day === '' ? 1 : b.day === '' ? -1 : b.day.localeCompare(a.day)));
}
