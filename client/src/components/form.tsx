// Form helpers shared by every sheet (React Hook Form + Zod).
import { forwardRef, useMemo, type InputHTMLAttributes } from 'react';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '../lib/api';
import { allTimeZones } from '../lib/time';
import { Input } from './ui';

/**
 * Puts Tripsy's 400 field errors beside the matching form fields. Returns a message for
 * anything that didn't map to a field (or for non-400 errors), else null.
 */
export function applyApiErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, known: readonly string[]): string | null {
  if (!(error instanceof ApiError) || error.status !== 400) return error instanceof Error ? error.message : 'Something went wrong.';
  const rest: string[] = [];
  for (const [field, msg] of Object.entries(error.fieldErrors)) {
    if (known.includes(field)) setError(field as Path<T>, { type: 'server', message: msg });
    else rest.push(field === 'non_field_errors' ? msg : `${field}: ${msg}`);
  }
  return rest.length ? rest.join(' ') : null;
}

/** Text input with a datalist of every IANA timezone. */
export const TimeZoneInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TimeZoneInput(props, ref) {
  const zones = useMemo(allTimeZones, []);
  return (
    <>
      <Input ref={ref} list="tz-list" placeholder="Europe/Rome" autoComplete="off" {...props} />
      <datalist id="tz-list">{zones.map((z) => <option key={z} value={z} />)}</datalist>
    </>
  );
});

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'MXN', 'BRL', 'CNY', 'INR', 'KRW', 'SEK', 'NOK', 'DKK', 'NZD', 'SGD', 'HKD', 'THB', 'ZAR', 'AED', 'TRY', 'PLN', 'CZK', 'ISK'];

/** 3-letter currency code input with suggestions. */
export const CurrencyInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function CurrencyInput(props, ref) {
  return (
    <>
      <Input ref={ref} list="currency-list" maxLength={3} placeholder="USD" autoComplete="off" className="uppercase" {...props} />
      <datalist id="currency-list">{CURRENCIES.map((c) => <option key={c} value={c} />)}</datalist>
    </>
  );
});

/** Empty input strings become null. */
export const blankToNull = <T,>(v: T | '' | undefined): T | null => (v === '' || v === undefined ? null : v);
export const toNumberOrNull = (v: unknown): number | null =>
  v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v);

/** Formats an amount in a currency, falling back to "12.00 XYZ" for unknown codes. */
export function money(amount: number, currency: string | null | undefined): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency ?? ''}`.trim();
  }
}
