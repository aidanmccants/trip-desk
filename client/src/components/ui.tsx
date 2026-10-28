// Shared UI kit in Tripsy's Apple-style visual language. Feature code should build on
// these rather than restyling raw elements.
import {
  forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes,
  type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Loader2, X, type LucideIcon } from 'lucide-react';
import { ApiError } from '../lib/api';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ─── Buttons ────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'plain' | 'danger';
const BUTTON: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:brightness-110',
  secondary: 'bg-fill/15 text-label hover:bg-fill/25',
  plain: 'text-accent hover:bg-accent/10',
  danger: 'bg-danger/10 text-danger hover:bg-danger/20',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: LucideIcon;
  loading?: boolean;
  size?: 'sm' | 'md';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', icon: Icon, loading, size = 'md', className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-pill font-semibold transition disabled:opacity-50',
        size === 'md' ? 'h-10 px-4 text-subhead' : 'h-8 px-3 text-footnote',
        BUTTON[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
});

/** Round translucent icon button (sheet close, "…", search). */
export function IconButton({
  icon: Icon, label, className, ...rest
}: { icon: LucideIcon; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('grid h-9 w-9 place-items-center rounded-full bg-fill/20 text-label hover:bg-fill/30 transition', className)}
      {...rest}
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}

/** Big circular quick action with caption ("New Activity", "Flights"…). */
export function QuickAction({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex w-20 flex-col items-center gap-1.5">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-fill/20 text-label backdrop-blur group-hover:bg-fill/30 transition">
        <Icon className="h-6 w-6" />
      </span>
      <span className="text-caption text-label-2">{label}</span>
    </button>
  );
}

// ─── Category badge ─────────────────────────────────────────────────────────

/** Colored icon on a 15% tint, as on Tripsy's itinerary rows. */
export function CategoryBadge({ icon: Icon, color, size = 'md' }: { icon: LucideIcon; color: string; size?: 'sm' | 'md' | 'lg' }) {
  const box = size === 'sm' ? 'h-7 w-7 rounded-lg' : size === 'lg' ? 'h-12 w-12 rounded-2xl' : 'h-9 w-9 rounded-badge';
  const ic = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
  return (
    <span className={cx('grid shrink-0 place-items-center', box)} style={{ backgroundColor: `${color}26`, color }}>
      <Icon className={ic} />
    </span>
  );
}

// ─── Sheets (modal cards) ───────────────────────────────────────────────────

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Footer, usually Cancel/Save buttons. */
  footer?: ReactNode;
  /** Left header slot, e.g. a share or delete IconButton. */
  leading?: ReactNode;
  width?: 'md' | 'lg' | 'xl';
}

/**
 * Centered modal card over the main pane. Escape and backdrop click close it. Sheets
 * stack; only the top one reacts to Escape.
 */
export function Sheet({ open, onClose, title, subtitle, children, footer, leading, width = 'md' }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const sheets = document.querySelectorAll('[data-sheet]');
      if (sheets[sheets.length - 1] === panel.current) {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    panel.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  const w = width === 'xl' ? 'max-w-3xl' : width === 'lg' ? 'max-w-2xl' : 'max-w-lg';
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6 md:pl-sidebar">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        data-sheet
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-sheet bg-bg shadow-sheet outline-none sm:rounded-sheet',
          w,
        )}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-fill/40 sm:hidden" />
        <header className="flex items-center gap-3 px-5 pb-3 pt-4">
          <div className="w-9">{leading}</div>
          <div className="min-w-0 flex-1 text-center">
            <h2 id={titleId} className="truncate text-headline">{title}</h2>
            {subtitle && <p className="truncate text-footnote text-label-3">{subtitle}</p>}
          </div>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </header>
        <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-separator/60 px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/** Confirmation dialog for deletes (never window.confirm). */
export function ConfirmDialog({
  open, title, message, confirmLabel = 'Delete', onConfirm, onCancel, busy,
}: {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="danger" loading={busy} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="text-callout text-label-2">{message ?? 'This cannot be undone from Trip Desk.'}</p>
    </Sheet>
  );
}

/** Hook for "ask before deleting": `const c = useConfirm(); c.ask(() => del())` + `{c.dialog}`. */
export function useConfirm(title = 'Delete this?', message?: ReactNode) {
  const [pending, setPending] = useState<null | (() => Promise<unknown> | void)>(null);
  const [busy, setBusy] = useState(false);
  const dialog = (
    <ConfirmDialog
      open={!!pending}
      title={title}
      message={message}
      busy={busy}
      onCancel={() => setPending(null)}
      onConfirm={async () => {
        if (!pending) return;
        setBusy(true);
        try {
          await pending();
          setPending(null);
        } finally {
          setBusy(false);
        }
      }}
    />
  );
  return { ask: (fn: () => Promise<unknown> | void) => setPending(() => fn), dialog };
}

// ─── Form fields ────────────────────────────────────────────────────────────

export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="label">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block px-1 text-footnote text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1 block px-1 text-footnote text-label-3">{hint}</span>
      ) : null}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx('input', className)} {...rest} />;
});

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea({ className, rows = 3, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={cx('input resize-y', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cx('input appearance-none pr-8', className)} {...rest}>
      {children}
    </select>
  );
});

/** iOS-style switch. Works controlled (`checked`/`onChange`). */
export function Toggle({ checked, onChange, label, description, disabled }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="row">
      <div className="min-w-0 flex-1">
        <div className="text-callout">{label}</div>
        {description && <div className="text-footnote text-label-3">{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-[31px] w-[51px] shrink-0 rounded-full transition disabled:opacity-40',
          checked ? 'bg-success' : 'bg-fill/30',
        )}
      >
        <span className={cx('absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-[2px]')} />
      </button>
    </div>
  );
}

/** Pill segmented control / filter chips. */
export function Segmented<T extends string>({ value, onChange, options, className }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cx('flex gap-1 overflow-x-auto rounded-pill bg-fill/15 p-1 scrollbar-none', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'whitespace-nowrap rounded-pill px-3.5 py-1.5 text-subhead font-medium transition',
            value === o.value ? 'bg-card text-label shadow-card' : 'text-label-2 hover:text-label',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Section card ───────────────────────────────────────────────────────────

/** Grouped card with an optional header row (icon + title + right slot), as Tripsy's "Itinerary" card. */
export function SectionCard({ title, icon, action, children, className }: {
  title?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('card overflow-hidden', className)}>
      {title && (
        <div className="flex items-center gap-3 px-4 pt-3.5 pb-2">
          {icon}
          <h3 className="flex-1 text-headline">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// ─── States ─────────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-xl bg-fill/15', className)} />;
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card divide-y divide-separator/40">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="row">
          <Skeleton className="h-9 w-9 rounded-badge" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, message, action }: { icon: LucideIcon; title: string; message?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-fill/15 text-label-3">
        <Icon className="h-8 w-8" />
      </span>
      <h3 className="text-title-3">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-subhead text-label-3">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Human message for an error, with Tripsy-specific wording for Pro and permission 403s. */
export function errorMessage(error: unknown, context?: 'documents' | 'expenses'): string {
  if (error instanceof ApiError) {
    if (error.status === 403 && context === 'documents') return 'Documents need Tripsy Pro for the trip owner, or permission to see documents.';
    if (error.status === 403 && context === 'expenses') return "You don't have permission to see this trip's expenses.";
    return error.message;
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}

export function ErrorNotice({ error, context, className }: { error: unknown; context?: 'documents' | 'expenses'; className?: string }) {
  if (!error) return null;
  return (
    <div className={cx('flex items-start gap-2 rounded-2xl bg-danger/10 px-4 py-3 text-subhead text-danger', className)}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{errorMessage(error, context)}</span>
    </div>
  );
}
