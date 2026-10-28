import { useRef, useState, type DragEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileUp, Loader2 } from 'lucide-react';
import type { Trip, UploadTicket } from '@shared/types';
import { ApiError } from '../../lib/api';
import { uploadFile } from '../../lib/upload';
import { Button, ErrorNotice, Field, Input, Sheet, cx, errorMessage } from '../../components/ui';
import { ParentPicker } from './ParentPicker';
import { MAX_UPLOAD_BYTES, attachDocument, invalidateDocuments, type Parent } from './docs';

type Phase = 'idle' | 'uploading' | 'attaching' | 'attach-failed';
const PHASE_LABEL: Record<Phase, string> = {
  idle: '',
  uploading: 'Preparing and uploading…',
  attaching: 'Attaching…',
  'attach-failed': '',
};

const fmtSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Upload a file (up to 100 MiB) and attach it. `parent` presets (and hides) the destination. */
export function UploadSheet({ trip, parent, open, onClose }: { trip: Trip; parent?: Parent; open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <Inner trip={trip} parent={parent} onClose={onClose} />;
}

function Inner({ trip, parent, onClose }: { trip: Trip; parent?: Parent; onClose: () => void }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState<Parent | null>(parent ?? { kind: 'trip', id: trip.id });
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<UploadTicket | null>(null);
  const [over, setOver] = useState(false);
  const busy = phase === 'uploading' || phase === 'attaching';
  const locked = busy || phase === 'attach-failed';
  const fileType = file ? file.type || 'application/octet-stream' : '';

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (f.size > MAX_UPLOAD_BYTES) {
      setError('That file is larger than 100 MB.');
      return;
    }
    setError(null);
    setTicket(null);
    setFile(f);
    setTitle((t) => t || f.name);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (!locked) pick(e.dataTransfer.files?.[0]);
  };

  async function attach(t: UploadTicket) {
    if (!file) return;
    const dest = target ?? { kind: 'trip' as const, id: trip.id };
    setPhase('attaching');
    setError(null);
    try {
      await attachDocument(trip.id, dest, {
        url: t.object_key,
        file_type: fileType,
        upload_token: t.upload_token,
        title: title.trim() || file.name,
      });
      await invalidateDocuments(qc, trip.id);
      onClose();
    } catch (e) {
      setError(errorMessage(e, 'documents'));
      setPhase('attach-failed');
    }
  }

  async function start() {
    if (!file) return;
    const dest = target ?? { kind: 'trip' as const, id: trip.id };
    setPhase('uploading');
    setError(null);
    let t: UploadTicket;
    try {
      t = await uploadFile(file, { purpose: 'document', parentType: dest.kind, parentId: dest.id });
    } catch (e) {
      setError(e instanceof ApiError ? errorMessage(e, 'documents') : "Couldn't upload to Tripsy storage from the browser.");
      setPhase('idle');
      return;
    }
    setTicket(t);
    await attach(t);
  }

  return (
    <Sheet
      open
      onClose={busy ? () => {} : onClose}
      title="Upload file"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          {phase === 'attach-failed' && ticket ? (
            <Button variant="primary" onClick={() => attach(ticket)}>Retry attach</Button>
          ) : (
            <Button variant="primary" loading={busy} disabled={!file} onClick={start}>Upload</Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {error && <ErrorNotice error={new Error(error)} />}
        {phase === 'attach-failed' && (
          <p className="text-footnote text-label-3">The file is uploaded. Retrying only attaches it again; nothing is re-uploaded.</p>
        )}
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={cx(
            'flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition',
            over ? 'border-accent bg-accent/10' : 'border-separator',
          )}
        >
          <FileUp className="h-8 w-8 text-label-3" />
          {file ? (
            <p className="text-callout">{file.name} <span className="text-label-3">({fmtSize(file.size)})</span></p>
          ) : (
            <p className="text-callout text-label-2">Drop a file here</p>
          )}
          <Button size="sm" disabled={locked} onClick={() => input.current?.click()}>{file ? 'Choose a different file' : 'Choose file'}</Button>
          <p className="text-footnote text-label-3">Up to 100 MB</p>
          <input ref={input} type="file" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={locked} maxLength={255} />
        </Field>
        {!parent && !locked && <ParentPicker tripId={trip.id} value={target} onChange={setTarget} />}
        {busy && (
          <p className="flex items-center gap-2 text-subhead text-label-2">
            <Loader2 className="h-4 w-4 animate-spin" /> {PHASE_LABEL[phase]}
          </p>
        )}
      </div>
    </Sheet>
  );
}
