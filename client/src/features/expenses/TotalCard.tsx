// Shared "Total in USD" card body used by the Expenses tab and the Overview summary.
import { useState } from 'react';
import { CategoryBadge, Segmented, cx } from '../../components/ui';
import { money } from '../../components/form';
import { byCategory, totalsByCurrency, type ExpenseLine } from './totals';

export function TotalCard({ lines, limit, hidden }: { lines: ExpenseLine[]; limit?: number; hidden?: boolean }) {
  const totals = totalsByCurrency(lines);
  const [picked, setPicked] = useState<string | null>(null);
  const currency = totals.find((t) => t.currency === picked)?.currency ?? totals[0]?.currency;
  if (!currency) return null;
  const total = totals.find((t) => t.currency === currency)!.total;
  const cats = byCategory(lines, currency).slice(0, limit);
  const show = (n: number) => (hidden ? '•••••' : money(n, currency));
  return (
    <div className="px-4 pb-4 pt-1">
      {totals.length > 1 && (
        <Segmented className="mb-3 w-fit" value={currency} onChange={setPicked} options={totals.map((t) => ({ value: t.currency, label: t.currency }))} />
      )}
      <div className="text-subhead text-label-3">Total in {currency}</div>
      <div className={cx('text-large-title font-bold tabular-nums', hidden && 'tracking-widest')}>{show(total)}</div>
      <div className="mt-3 divide-y divide-separator/40">
        {cats.map((c) => (
          <div key={c.label} className="flex items-center gap-3 py-2">
            <CategoryBadge icon={c.icon} color={c.color} size="sm" />
            <span className="flex-1 text-callout">{c.label}</span>
            <span className="text-callout tabular-nums text-label-2">{show(c.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
