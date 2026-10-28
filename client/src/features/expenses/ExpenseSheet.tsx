// Create / edit / delete a standalone trip expense.
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import type { Expense, Trip } from '@shared/types';
import { EXPENSE_FIELDS } from '@shared/fields';
import { api, diff } from '../../lib/api';
import { qk, useMe } from '../../lib/queries';
import { localInputToUtc, utcToLocalInput } from '../../lib/time';
import { Button, ErrorNotice, Field, IconButton, Input, Sheet, useConfirm } from '../../components/ui';
import { CurrencyInput, applyApiErrors } from '../../components/form';

const schema = z.object({
  title: z.string().trim().min(1, 'Enter a title'),
  date: z.string().min(1, 'Pick a date'),
  price: z.string().refine((v) => v.trim() !== '' && Number(v) > 0, 'Enter an amount greater than 0'),
  currency: z.string().trim().length(3, 'Use a 3-letter code'),
});
type Values = z.infer<typeof schema>;

export function ExpenseSheet({ trip, expense, open, onClose }: {
  trip: Trip;
  expense?: Expense | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const me = useMe();
  const tz = trip.timezone;
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', date: '', price: '', currency: '' },
  });

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    reset(
      expense
        ? { title: expense.title, date: utcToLocalInput(expense.date, tz), price: String(expense.price), currency: expense.currency }
        : {
            title: '',
            date: utcToLocalInput(new Date().toISOString(), tz),
            price: '',
            currency: me.data?.default_currency ?? 'USD',
          },
    );
  }, [open, expense, tz, me.data?.default_currency, reset]);

  const save = useMutation({
    mutationFn: async (v: Values) => {
      const payload = {
        title: v.title.trim(),
        date: localInputToUtc(v.date, tz) ?? new Date().toISOString(),
        price: Number(v.price),
        currency: v.currency.trim().toUpperCase(),
      };
      if (!expense) return api.post(`/v1/trip/${trip.id}/expenses`, payload);
      // Compare the date at minute precision so an untouched date isn't re-sent.
      const prevDate = localInputToUtc(utcToLocalInput(expense.date, tz), tz) ?? expense.date;
      const changes = diff(payload, { title: expense.title, date: prevDate, price: expense.price, currency: expense.currency });
      if (Object.keys(changes).length === 0) return null;
      return api.patch(`/v1/trip/${trip.id}/expense/${expense.id}`, changes);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.expenses(trip.id) });
      onClose();
    },
    onError: (e) => setFormError(applyApiErrors<Values>(e, setError, EXPENSE_FIELDS)),
  });

  const confirm = useConfirm('Delete this expense?');
  const remove = () =>
    confirm.ask(async () => {
      try {
        await api.del(`/v1/trip/${trip.id}/expense/${expense!.id}`);
        await qc.invalidateQueries({ queryKey: qk.expenses(trip.id) });
        onClose();
      } catch (e) {
        setFormError(e instanceof Error ? e.message : 'Could not delete.');
      }
    });

  const submit = handleSubmit((v) => {
    setFormError(null);
    save.mutate(v);
  });

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={expense ? 'Edit expense' : 'New expense'}
        leading={expense ? <IconButton icon={Trash2} label="Delete expense" onClick={remove} /> : undefined}
        footer={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" loading={save.isPending} onClick={submit}>
              {expense ? 'Save' : 'Add expense'}
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={submit}>
          <ErrorNotice error={formError ? new Error(formError) : null} />
          <Field label="Title" error={errors.title?.message}>
            <Input autoFocus placeholder="Dinner, museum tickets" {...register('title')} />
          </Field>
          <Field label={`Date${tz ? ` (${tz})` : ''}`} error={errors.date?.message}>
            <Input type="datetime-local" {...register('date')} />
          </Field>
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <Field label="Price" error={errors.price?.message}>
              <Input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" {...register('price')} />
            </Field>
            <Field label="Currency" error={errors.currency?.message}>
              <CurrencyInput {...register('currency')} />
            </Field>
          </div>
          <button type="submit" className="hidden" />
        </form>
      </Sheet>
      {confirm.dialog}
    </>
  );
}
