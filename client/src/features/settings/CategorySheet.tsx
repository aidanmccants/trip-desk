// Create or edit one of the user's custom categories. Create POSTs to /v1/categories; edit
// PATCHes /v1/categories/{id} with only the changed fields.
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { CATEGORY_FIELDS } from '@shared/fields';
import type { Category } from '@shared/types';
import { api, diff } from '../../lib/api';
import { qk } from '../../lib/queries';
import { applyApiErrors } from '../../components/form';
import { Button, ErrorNotice, Field, Input, Sheet } from '../../components/ui';

const DEFAULT_COLOR = '#4A90E2';
// Tripsy answers an empty 200 to a create when the slug is already taken.
const SLUG_TAKEN = 'A category with this slug already exists.';

const CategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  slug: z.string().trim(),
  icon_name: z.string().trim(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a color.'),
});
type CategoryValues = z.infer<typeof CategorySchema>;

export interface CategorySheetProps {
  open: boolean;
  onClose: () => void;
  /** Omit to create a new category. */
  category?: Category;
}

export function CategorySheet({ open, onClose, category }: CategorySheetProps) {
  // The form lives in its own component so each opening starts with a fresh form.
  if (!open) return null;
  return <CategoryDialog category={category} onClose={onClose} />;
}

function CategoryDialog({ category, onClose }: { category?: Category; onClose: () => void }) {
  const qc = useQueryClient();
  const formId = useId();
  const editing = category !== undefined;
  const [formError, setFormError] = useState<string | null>(null);
  const initialColor = (category?.color || DEFAULT_COLOR).toLowerCase();

  const form = useForm<CategoryValues>({
    resolver: zodResolver(CategorySchema),
    defaultValues: {
      name: category?.name ?? '',
      slug: category?.slug ?? '',
      icon_name: category?.icon_name ?? '',
      color: initialColor,
    },
  });
  const { errors, isDirty, isSubmitting } = form.formState;

  const onSubmit = async (v: CategoryValues) => {
    setFormError(null);
    try {
      if (category) {
        // Activities store the slug as their type, so an edit cannot leave it blank.
        if (!v.slug) {
          form.setError('slug', { type: 'manual', message: 'A category needs a slug.' });
          return;
        }
        const original = {
          name: category.name,
          slug: category.slug,
          icon_name: category.icon_name ?? '',
          color: initialColor,
        };
        const next = {
          name: v.name,
          slug: v.slug,
          icon_name: v.icon_name,
          color: v.color.toLowerCase(),
        };
        const changes = diff(next, original);
        if (Object.keys(changes).length > 0) {
          await api.patch<Category>(`/v1/categories/${category.id}`, changes);
        }
      } else {
        const body: Record<string, string> = { name: v.name, color: v.color.toLowerCase() };
        if (v.slug) body.slug = v.slug;
        if (v.icon_name) body.icon_name = v.icon_name;
        const created = await api.post<Category | null>('/v1/categories', body);
        if (created === null) {
          if (v.slug) form.setError('slug', { type: 'server', message: SLUG_TAKEN });
          else setFormError(SLUG_TAKEN);
          return;
        }
      }
      await qc.invalidateQueries({ queryKey: qk.categories });
      onClose();
    } catch (e) {
      setFormError(applyApiErrors(e, form.setError, CATEGORY_FIELDS));
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={editing ? 'Edit category' : 'New category'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            loading={isSubmitting}
            disabled={editing && !isDirty}
          >
            Save
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
        {formError && <ErrorNotice error={new Error(formError)} />}

        <Field label="Name" error={errors.name?.message}>
          <Input {...form.register('name')} />
        </Field>

        <Field
          label="Slug (optional)"
          hint="Activities store this value as their type."
          error={errors.slug?.message}
        >
          <Input placeholder="e.g. climbing" autoComplete="off" {...form.register('slug')} />
        </Field>

        <Field label="Color" hint="Tints the category's icon." error={errors.color?.message}>
          <input
            type="color"
            className="h-11 w-20 cursor-pointer rounded-xl border-0 bg-card-2 p-1"
            {...form.register('color')}
          />
        </Field>

        <Field label="Icon name (optional)" error={errors.icon_name?.message}>
          <Input autoComplete="off" {...form.register('icon_name')} />
        </Field>
      </form>
    </Sheet>
  );
}
