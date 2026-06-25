'use client';

import { ChevronRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AttestationBadge } from './attestation-badge';
import { CopyButton } from '@/components/ui/copy-button';
import { cn } from '@/lib/cn';
import { formatTime, truncateMiddle } from '@/lib/format';
import type { Attestation, AuditEntry, AuditEventType } from '@/lib/types';

// DECISION/APPROVAL audit payloads carry the signed attestation of the verdict.
function attestationOf(entry: AuditEntry): Attestation | undefined {
  const p = entry.payload as Record<string, unknown> | null;
  const att = p && typeof p === 'object' ? p.attestation : undefined;
  return att && typeof att === 'object' ? (att as Attestation) : undefined;
}

// The API doesn't return conversationId at the top level (it's a denormalized DB
// column used only for filtering) — it lives inside the payload. Read it from there.
function conversationIdOf(entry: AuditEntry): string | undefined {
  if (entry.conversationId) return entry.conversationId;
  const p = entry.payload;
  if (p && typeof p === 'object' && typeof (p as Record<string, unknown>).conversationId === 'string') {
    return (p as Record<string, unknown>).conversationId as string;
  }
  return undefined;
}

const EVENT_CLS: Record<AuditEventType, string> = {
  PROPOSAL: 'bg-secondary text-secondary-foreground',
  DECISION: 'bg-primary/10 text-primary',
  EXECUTION: 'bg-allow-soft text-allow',
  APPROVAL: 'bg-pending-soft text-pending',
};

export function AuditTable({ entries }: { entries: AuditEntry[] }) {
  // newest first
  const rows = [...entries].sort((a, b) => b.sequence - a.sequence);
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="w-12 px-4 py-2.5 font-medium">#</th>
            <th className="w-24 px-3 py-2.5 font-medium">Time</th>
            <th className="w-36 px-3 py-2.5 font-medium">Event</th>
            <th className="px-3 py-2.5 font-medium">Hash</th>
            <th className="w-10 px-3 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((e) => (
            <AuditRow key={e.id} entry={e} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const convId = conversationIdOf(entry);
  const attestation = attestationOf(entry);
  return (
    <>
      <tr className="align-top">
        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{entry.sequence}</td>
        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{formatTime(entry.timestamp)}</td>
        <td className="px-3 py-2.5">
          <span className="inline-flex items-center gap-1.5">
            <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', EVENT_CLS[entry.eventType])}>
              {entry.eventType}
            </span>
            {attestation && (
              <span
                className="inline-flex text-primary"
                aria-label="signed verdict"
                title={`Signed verdict · keyId ${attestation.keyId}`}
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              </span>
            )}
          </span>
        </td>
        <td className="px-3 py-2.5">
          <span className="inline-flex items-center gap-1">
            <span className="font-mono text-xs" title={entry.hash}>
              {truncateMiddle(entry.hash, 8, 6)}
            </span>
            <CopyButton value={entry.hash} label="Copy hash" />
          </span>
        </td>
        <td className="px-3 py-2.5">
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? 'Hide details' : 'Show details'}
            onClick={() => setOpen((v) => !v)}
            className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ChevronRight className={cn('h-4 w-4 transition-transform', open && 'rotate-90')} aria-hidden />
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} className="bg-muted/40 px-4 py-3">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">prev</dt>
              <dd className="flex items-center gap-1 break-all font-mono">
                {truncateMiddle(entry.prevHash, 10, 8)}
                <CopyButton value={entry.prevHash} label="Copy previous hash" />
              </dd>
              <dt className="text-muted-foreground">hash</dt>
              <dd className="break-all font-mono">{entry.hash}</dd>
              {convId && (
                <>
                  <dt className="text-muted-foreground">conv</dt>
                  <dd className="break-all font-mono">
                    <Link
                      href={`/audit?conversationId=${encodeURIComponent(convId)}`}
                      className="text-primary hover:underline"
                    >
                      {convId}
                    </Link>
                  </dd>
                </>
              )}
            </dl>
            {attestation && (
              <div className="mt-3">
                <AttestationBadge attestation={attestation} />
              </div>
            )}
            <p className="mb-1 mt-3 text-xs text-muted-foreground">payload</p>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-card p-3 font-mono text-xs">
              {JSON.stringify(entry.payload, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}
