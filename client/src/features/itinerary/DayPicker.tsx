import { cx } from '../../components/ui';
import { fmtDay, todayDay } from '../../lib/time';

export type DaySelection = 'all' | 'unscheduled' | (string & {});

/** Horizontal pill row: All, one pill per day (weekday + number), Unscheduled. */
export function DayPicker({ days, value, onChange, hasUnscheduled }: {
  days: string[];
  value: DaySelection;
  onChange: (v: DaySelection) => void;
  hasUnscheduled: boolean;
}) {
  const today = todayDay();
  const base = 'shrink-0 rounded-pill px-3.5 py-2 text-subhead font-semibold transition';
  const on = 'bg-accent text-white';
  const off = 'bg-fill/15 text-label hover:bg-fill/25';
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none md:mx-0 md:px-0">
      <button type="button" onClick={() => onChange('all')} className={cx(base, value === 'all' ? on : off)}>All</button>
      {days.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          aria-label={fmtDay(d, 'EEEE, MMMM d')}
          className={cx(base, 'flex min-w-[3.25rem] flex-col items-center leading-tight', value === d ? on : off)}
        >
          <span className={cx('text-caption font-medium uppercase', value === d ? 'text-white/80' : d === today ? 'text-accent' : 'text-label-3')}>
            {fmtDay(d, 'EEE')}
          </span>
          <span className="text-headline">{fmtDay(d, 'd')}</span>
        </button>
      ))}
      {hasUnscheduled && (
        <button type="button" onClick={() => onChange('unscheduled')} className={cx(base, value === 'unscheduled' ? on : off)}>
          Unscheduled
        </button>
      )}
    </div>
  );
}
