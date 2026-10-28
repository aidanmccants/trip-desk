// "Custom categories" card on the settings page. Lists GET /v1/categories; only categories
// the signed-in user owns can be edited or deleted.
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { Category } from '@shared/types';
import { api } from '../../lib/api';
import { qk, useCategories } from '../../lib/queries';
import { Button, ErrorNotice, IconButton, SectionCard, Skeleton, useConfirm } from '../../components/ui';
import { CategorySheet } from './CategorySheet';

export function CategoriesSection({ meId }: { meId: number | undefined }) {
  const qc = useQueryClient();
  const categories = useCategories();
  const [sheet, setSheet] = useState<{ category?: Category } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const confirm = useConfirm(
    'Delete this category?',
    'It is removed from your list. This cannot be undone from Trip Desk.',
  );
  // Stable so the sheet's Escape/focus effect does not re-run on every render.
  const closeSheet = useCallback(() => setSheet(null), []);

  // Resolves even on failure so the confirm dialog closes; the error is shown in the card.
  async function remove(c: Category) {
    setError(null);
    try {
      await api.del(`/v1/categories/${c.id}`);
      await qc.invalidateQueries({ queryKey: qk.categories });
    } catch (e) {
      setError(e);
    }
  }

  const rows = categories.data ?? [];

  return (
    <>
      <SectionCard
        title="Custom categories"
        action={
          <Button variant="plain" size="sm" icon={Plus} onClick={() => setSheet({})}>
            New category
          </Button>
        }
      >
        {categories.isPending ? (
          <div aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="row">
                <Skeleton className="h-3.5 w-3.5 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : categories.error ? (
          <div className="px-4 pb-3">
            <ErrorNotice error={categories.error} />
          </div>
        ) : rows.length === 0 ? (
          <div className="row text-subhead text-label-3">No custom categories yet.</div>
        ) : (
          rows.map((c) => (
            <CategoryRow
              key={c.id}
              category={c}
              editable={meId !== undefined && c.owner === meId}
              onEdit={() => setSheet({ category: c })}
              onDelete={() => confirm.ask(() => remove(c))}
            />
          ))
        )}

        {error ? (
          <div className="px-4 pb-3">
            <ErrorNotice error={error} />
          </div>
        ) : null}
      </SectionCard>

      <CategorySheet open={sheet !== null} category={sheet?.category} onClose={closeSheet} />
      {confirm.dialog}
    </>
  );
}

function CategoryRow({ category, editable, onEdit, onDelete }: {
  category: Category;
  editable: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="row">
      <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-callout">{category.name}</div>
        <div className="truncate text-footnote text-label-3">{category.slug}</div>
      </div>
      {editable && (
        <>
          <IconButton icon={Pencil} label={`Edit ${category.name}`} onClick={onEdit} />
          <IconButton icon={Trash2} label={`Delete ${category.name}`} onClick={onDelete} className="text-danger" />
        </>
      )}
    </div>
  );
}
