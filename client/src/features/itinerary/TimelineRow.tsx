import { Check, Moon, Sun, Sunrise, Sunset, Globe2 } from 'lucide-react';
import type { Activity, Category } from '@shared/types';
import { detailLine, entryTitle, type TimelineEntry } from '../../lib/itinerary';
import { itemMeta } from '../../lib/categories';
import { fmtIn, timeOfDay, zoneAbbr } from '../../lib/time';
import { CategoryBadge, cx } from '../../components/ui';

const GLYPH = { morning: Sunrise, afternoon: Sun, evening: Sunset, night: Moon } as const;

export function TzDivider({ entry }: { entry: TimelineEntry }) {
  if (!entry.at || !entry.tz) return null;
  return (
    <div className="flex items-center gap-2 bg-card-2/60 px-4 py-1.5 text-caption text-label-3">
      <Globe2 className="h-3.5 w-3.5" />
      Time zone changes to {entry.tz} ({zoneAbbr(entry.at, entry.tz)})
    </div>
  );
}

/** One itinerary row: badge on a vertical connector, title and detail, time on the right. */
export function TimelineRow({ entry, categories, first, last, onClick }: {
  entry: TimelineEntry;
  categories: Category[];
  first: boolean;
  last: boolean;
  onClick: () => void;
}) {
  const meta = itemMeta(entry.kind, entry.item, categories);
  const detail = detailLine(entry);
  const done = entry.kind === 'activity' && (entry.item as Activity).checked;
  const Glyph = entry.at && !entry.allDay ? GLYPH[timeOfDay(entry.at, entry.tz)] : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-fill/10"
    >
      <span
        aria-hidden
        className={cx('absolute left-[2.125rem] w-px bg-separator', first ? 'top-1/2' : 'top-0', last ? 'bottom-1/2' : 'bottom-0')}
      />
      <span className="relative z-10 rounded-badge bg-card">
        <CategoryBadge icon={meta.icon} color={meta.color} />
      </span>
      <div className="min-w-0 flex-1">
        <div className={cx('truncate text-callout font-medium', done && 'text-label-3 line-through')}>{entryTitle(entry)}</div>
        {detail && <div className="truncate text-footnote text-label-3">{detail}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5 text-subhead text-label-2">
        {done && <Check className="h-4 w-4 text-success" />}
        {entry.allDay || !entry.at ? (
          entry.allDay && <span className="text-footnote text-label-3">All day</span>
        ) : (
          <>
            {Glyph && <Glyph className="h-3.5 w-3.5 text-label-3" />}
            {fmtIn(entry.at, entry.tz, 'h:mm a')}
          </>
        )}
      </div>
    </button>
  );
}
