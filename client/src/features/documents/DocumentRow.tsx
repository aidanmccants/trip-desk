import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FolderInput, Loader2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { cx } from '../../components/ui';
import { isHttpUrl } from './docs';

/** Small popover menu behind a "…" button. */
export function RowMenu({ items }: { items: { label: string; icon: 'rename' | 'move' | 'delete'; onSelect: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const ICON = { rename: Pencil, move: FolderInput, delete: Trash2 };
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid h-8 w-8 place-items-center rounded-full text-label-3 hover:bg-fill/20 hover:text-label"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-9 z-30 min-w-[150px] overflow-hidden rounded-xl bg-card py-1 shadow-sheet ring-1 ring-separator/50">
          {items.map((it) => {
            const Icon = ICON[it.icon];
            return (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                onClick={() => { setOpen(false); it.onSelect(); }}
                className={cx('flex w-full items-center gap-2 px-3 py-2 text-left text-subhead hover:bg-fill/15', it.icon === 'delete' && 'text-danger')}
              >
                <Icon className="h-4 w-4" /> {it.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** One row in a documents list: leading badge, title/subtitle, optional thumbnail and menu. */
export function DocumentRow({ badge, title, subtitle, thumbUrl, busy, onClick, menu }: {
  badge: ReactNode;
  title: string;
  subtitle?: string;
  thumbUrl?: string | null;
  busy?: boolean;
  onClick: () => void;
  menu?: ReactNode;
}) {
  return (
    <div className="row">
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        {badge}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-callout font-medium">{title}</span>
          {subtitle && <span className="block truncate text-footnote text-label-3">{subtitle}</span>}
        </span>
        {busy && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-label-3" />}
        {isHttpUrl(thumbUrl) && (
          <img src={thumbUrl} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
        )}
      </button>
      {menu}
    </div>
  );
}
