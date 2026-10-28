import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Paperclip } from 'lucide-react';
import type { EmailDetail } from '@shared/types';
import { api } from '../../lib/api';
import { ErrorNotice, Sheet, Skeleton } from '../../components/ui';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Wraps untrusted email content for a sandboxed iframe. The sandbox attribute is the
 * real protection; the CSP meta additionally blocks scripts, frames and remote styles.
 */
export function emailSrcDoc(content: string): string {
  const looksHtml = /<\/?[a-z][\s\S]*>/i.test(content);
  const body = looksHtml ? content : `<pre style="white-space:pre-wrap;font:inherit;margin:0">${escapeHtml(content)}</pre>`;
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src https: data:; style-src \'unsafe-inline\'">' +
    '<meta name="referrer" content="no-referrer">' +
    '<style>html,body{background:#fff;color:#111;font:14px/1.5 -apple-system,system-ui,sans-serif;margin:0;padding:12px;word-wrap:break-word}img{max-width:100%;height:auto}</style>' +
    `</head><body>${body}</body></html>`
  );
}

function payloadNote(a: EmailDetail['attachments'][number]): string {
  if (a.binary) return 'binary';
  if (a.payload) return `${a.payload.length.toLocaleString()} characters`;
  return 'empty';
}

/**
 * Read-only email viewer. `path` is the detail route (v2 trip email or v1 inbox email),
 * `queryKey` its cache key. `footer` receives the loaded email for actions.
 */
export function EmailViewerSheet({ path, queryKey, onClose, footer, leading, fallbackTitle = 'Email' }: {
  path: string;
  queryKey: readonly unknown[];
  onClose: () => void;
  footer?: (email: EmailDetail | undefined) => ReactNode;
  leading?: (email: EmailDetail | undefined) => ReactNode;
  fallbackTitle?: string;
}) {
  const q = useQuery({ queryKey: [...queryKey, 'detail'], queryFn: () => api.get<EmailDetail>(path), staleTime: 0 });
  const email = q.data;
  const srcDoc = useMemo(() => (email ? emailSrcDoc(email.content ?? '') : ''), [email]);
  return (
    <Sheet
      open
      onClose={onClose}
      width="xl"
      title={email?.subject || fallbackTitle}
      subtitle={email ? new Date(email.date).toLocaleString() : undefined}
      leading={leading?.(email)}
      footer={footer?.(email)}
    >
      {q.isLoading ? (
        <div className="space-y-3"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-[40vh] w-full" /></div>
      ) : q.error ? (
        <ErrorNotice error={q.error} context="documents" />
      ) : email ? (
        <div className="space-y-4">
          {email.attachments?.length > 0 && (
            <ul className="card divide-y divide-separator/40">
              {email.attachments.map((a) => (
                <li key={a.id} className="row">
                  <Paperclip className="h-4 w-4 shrink-0 text-label-3" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-callout">{a.filename || 'Attachment'}</div>
                    <div className="truncate text-footnote text-label-3">{a.mail_content_type} · {payloadNote(a)}</div>
                  </div>
                </li>
              ))}
              <li className="px-4 py-2 text-footnote text-label-3">Attachments can’t be downloaded from here.</li>
            </ul>
          )}
          <iframe
            title="Email content"
            sandbox=""
            referrerPolicy="no-referrer"
            srcDoc={srcDoc}
            className="h-[60vh] w-full rounded-2xl border border-separator/60 bg-white"
          />
        </div>
      ) : null}
    </Sheet>
  );
}
