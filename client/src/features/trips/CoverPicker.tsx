// Trip cover chooser: gradient swatches or an uploaded photo. `CoverSheet` wraps it for
// saving just the cover fields on an existing trip (header "Change cover").
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import type { Trip } from '@shared/types';
import { api, diff } from '../../lib/api';
import { invalidateTrip } from '../../lib/queries';
import { GRADIENTS, coverBackground } from '../../lib/gradients';
import { uploadFile } from '../../lib/upload';
import { Button, ErrorNotice, Sheet, cx } from '../../components/ui';

export interface CoverValue {
  cover_gradient: number | null;
  cover_image_url: string | null;
}

export function CoverPicker({ value, onChange, tripId, previewId = 0 }: {
  value: CoverValue;
  onChange: (v: CoverValue) => void;
  tripId?: number;
  previewId?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const ticket = await uploadFile(file, { purpose: 'trip_cover', tripId });
      if (!ticket.public_url) throw new Error('No public URL was returned for the photo.');
      onChange({ cover_gradient: value.cover_gradient, cover_image_url: ticket.public_url });
    } catch (e) {
      // A failed PUT to the storage host is almost always a CORS rejection.
      setError(e instanceof TypeError || (e instanceof Error && e.message.startsWith('Upload to storage'))
        ? "Couldn't upload to Tripsy storage. Pick a gradient instead, or try again later."
        : e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const preview = { id: previewId, ...value };
  const selected = value.cover_image_url ? -1 : value.cover_gradient ?? (previewId % GRADIENTS.length);
  return (
    <div className="space-y-3">
      <div className="relative h-32 overflow-hidden rounded-card" style={{ background: coverBackground(preview) }}>
        {uploading && (
          <div className="absolute inset-0 grid place-items-center bg-black/40 text-white">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
      </div>
      <div className="grid grid-cols-6 gap-2">
        {GRADIENTS.map((g, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Gradient ${i + 1}`}
            onClick={() => onChange({ cover_gradient: i, cover_image_url: null })}
            className={cx('grid aspect-square place-items-center rounded-xl text-white ring-offset-2 ring-offset-bg transition', selected === i && 'ring-2 ring-accent')}
            style={{ background: g }}
          >
            {selected === i && <Check className="h-4 w-4" />}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <Button size="sm" icon={ImagePlus} loading={uploading} onClick={() => fileRef.current?.click()}>Upload photo</Button>
        {value.cover_image_url && (
          <Button size="sm" variant="danger" icon={Trash2} onClick={() => onChange({ ...value, cover_image_url: null })}>Remove photo</Button>
        )}
      </div>
      <ErrorNotice error={error ? new Error(error) : null} />
    </div>
  );
}

/** Saves only the cover fields (PATCH) for an existing trip. */
export function CoverSheet({ open, onClose, trip }: { open: boolean; onClose: () => void; trip: Trip }) {
  const qc = useQueryClient();
  const original: CoverValue = { cover_gradient: trip.cover_gradient, cover_image_url: trip.cover_image_url };
  const [value, setValue] = useState<CoverValue>(original);
  const save = useMutation({
    mutationFn: async () => {
      const body = diff({ ...value }, original);
      if (Object.keys(body).length) await api.patch(`/v1/trips/${trip.id}`, body);
    },
    onSuccess: async () => {
      await invalidateTrip(qc, trip.id);
      onClose();
    },
  });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Change cover"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
        </>
      }
    >
      <div className="space-y-3">
        <CoverPicker value={value} onChange={setValue} tripId={trip.id} previewId={trip.id} />
        <ErrorNotice error={save.error} />
      </div>
    </Sheet>
  );
}
