'use client';

import { ChevronRight, CornerDownRight, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AttestationBadge } from '@/components/audit/attestation-badge';
import { Button } from '@/components/ui/button';
import { StatusBadge, Tag } from '@/components/ui/status-badge';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { TimelineItem } from '@/lib/use-guardrail-stream';

type ProposalItem = Extract<TimelineItem, { kind: 'proposal' }>;

// left rail color tracks the lifecycle: awaiting decision → pending → allow/deny
function railClass(item: ProposalItem): string {
  if (item.approvalId) return 'border-l-pending';
  if (!item.decision) return 'border-l-border';
  return item.decision.status === 'ALLOW'
    ? 'border-l-allow'
    : item.decision.status === 'DENY'
      ? 'border-l-deny'
      : 'border-l-pending';
}

function formatArgValue(v: unknown): string {
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

export function ProposalRow({ item, approvalTimeout }: { item: ProposalItem; approvalTimeout?: number }) {
  const { proposal, decision, result } = item;
  const args = Object.entries(proposal.args ?? {});

  return (
    <article className={cn('aiq-enter rounded-lg border border-l-2 border-border bg-card', railClass(item))}>
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 pt-3">
        <span className="font-mono text-sm font-medium text-foreground">{proposal.toolName}</span>
        <Tag className="font-mono">{proposal.serverId}</Tag>
        <div className="ml-auto">
          {decision ? (
            <StatusBadge status={decision.status} />
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Evaluating
            </span>
          )}
        </div>
      </header>

      {proposal.reasoning && (
        <p className="px-4 pt-2 text-sm leading-relaxed text-muted-foreground">{proposal.reasoning}</p>
      )}

      {args.length > 0 && (
        <dl className="mx-4 mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md bg-muted/60 px-3 py-2 text-xs">
          {args.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-mono text-muted-foreground">{k}</dt>
              <dd className="break-all font-mono text-foreground">{formatArgValue(v)}</dd>
            </div>
          ))}
        </dl>
      )}

      {decision && (
        <p
          className={cn(
            'flex items-start gap-1.5 px-4 pt-2 text-xs',
            decision.status === 'ALLOW' && 'text-allow',
            decision.status === 'DENY' && 'text-deny',
            decision.status === 'PENDING_APPROVAL' && 'text-pending',
          )}
        >
          <ChevronRight className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {decision.reason}
            {decision.matchedRuleId && (
              <span className="ml-1 font-mono text-muted-foreground">· {decision.matchedRuleId}</span>
            )}
          </span>
        </p>
      )}

      {item.attestation && (
        <div className="px-4 pt-2">
          <AttestationBadge attestation={item.attestation} />
        </div>
      )}

      {item.approvalId && !result && (
        <ApprovalActions approvalId={item.approvalId} timeoutSeconds={approvalTimeout} />
      )}

      {result && (
        <div className="mx-4 my-3 rounded-md border border-border bg-muted/40 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium">
            <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <span className={result.success ? 'text-allow' : 'text-deny'}>
              {result.success ? 'Executed' : 'Failed'}
            </span>
          </p>
          {result.error && <p className="font-mono text-xs text-deny">{result.error}</p>}
          {result.data !== undefined && (
            <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-muted-foreground">
              {typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2)}
            </pre>
          )}
        </div>
      )}
      {!item.approvalId && !result && decision?.status === 'ALLOW' && (
        <div className="px-4 pb-3" />
      )}
    </article>
  );
}

// Human approval gate. Countdown comes from the matching REQUIRE_APPROVAL rule's
// timeoutSeconds (the socket event doesn't carry it); indeterminate if unknown.
function ApprovalActions({ approvalId, timeoutSeconds }: { approvalId: string; timeoutSeconds?: number }) {
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState<null | 'ALLOW' | 'DENY'>(null);
  const [failed, setFailed] = useState(false);

  // Tick elapsed via a functional updater inside the callback (no setState in the
  // effect body). `remaining` is derived during render.
  useEffect(() => {
    if (timeoutSeconds === undefined) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [timeoutSeconds]);

  const remaining = timeoutSeconds === undefined ? undefined : Math.max(0, timeoutSeconds - elapsed);

  async function respond(decision: 'ALLOW' | 'DENY') {
    setBusy(decision);
    setFailed(false);
    try {
      await api.respondApproval(approvalId, decision);
      // the stream will deliver the execution result and clear this gate
    } catch {
      setBusy(null);
      setFailed(true);
    }
  }

  const expired = remaining === 0;

  return (
    <div className="m-4 mt-3 rounded-md border border-pending/40 bg-pending-soft p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-pending">
          Awaiting your approval
          {remaining !== undefined ? (
            <span className="ml-1.5 font-mono text-muted-foreground">
              · {expired ? 'resolving…' : `${remaining}s left`}
            </span>
          ) : (
            <span className="ml-1.5 font-mono text-muted-foreground">· no timeout</span>
          )}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="allow"
            disabled={busy !== null || expired}
            onClick={() => respond('ALLOW')}
          >
            {busy === 'ALLOW' && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            Approve
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={busy !== null || expired}
            onClick={() => respond('DENY')}
          >
            {busy === 'DENY' && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            Deny
          </Button>
        </div>
      </div>
      {failed && (
        <p className="mt-2 text-xs text-deny">Couldn&apos;t submit your decision. It may have already timed out — try again.</p>
      )}
    </div>
  );
}
