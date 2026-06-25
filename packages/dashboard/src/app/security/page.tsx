import { ShieldAlert, ShieldX } from 'lucide-react';
import Link from 'next/link';
import { PageHeader, PageScroll } from '@/components/ui/page';
import { StateBlock } from '@/components/ui/state-block';
import { Unreachable } from '@/components/ui/unreachable';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatTime, truncateMiddle } from '@/lib/format';
import type { AuditEntry } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface SecurityEvent {
  sequence: number;
  timestamp: string;
  tool: string;
  reason: string;
  layer: string;
  conversationId?: string;
}

// Which defense layer produced a DENY — derived from the verdict's reason / matched rule.
function layerOf(reason: string, matchedRuleId?: string): string {
  if (matchedRuleId === 'semantic-firewall') return 'Semantic firewall';
  if (/circuit breaker/i.test(reason)) return 'Circuit breaker';
  if (/heuristic|injection/i.test(reason)) return 'Injection heuristic';
  if (/input validation/i.test(reason)) return 'Input validation';
  if (/budget/i.test(reason)) return 'Budget limit';
  if (/approval denied/i.test(reason)) return 'Approval denied';
  return 'Policy rule';
}

// Pull blocked tool calls out of the audit log (DECISION/APPROVAL entries whose verdict is DENY).
function denyEventsOf(entries: AuditEntry[]): SecurityEvent[] {
  const out: SecurityEvent[] = [];
  for (const e of entries) {
    if (e.eventType !== 'DECISION' && e.eventType !== 'APPROVAL') continue;
    const p = e.payload as Record<string, unknown> | null;
    const dec = p?.decision as { status?: string; reason?: string; matchedRuleId?: string } | undefined;
    if (!dec || dec.status !== 'DENY') continue;
    const signed = (p?.attestation as { signed?: { toolName?: string } } | undefined)?.signed;
    out.push({
      sequence: e.sequence,
      timestamp: e.timestamp,
      tool: signed?.toolName ?? '—',
      reason: dec.reason ?? '',
      layer: layerOf(dec.reason ?? '', dec.matchedRuleId),
      conversationId: typeof p?.conversationId === 'string' ? (p.conversationId as string) : undefined,
    });
  }
  return out.sort((a, b) => b.sequence - a.sequence);
}

export default async function SecurityPage() {
  const [auditR, configR] = await Promise.allSettled([api.getAudit(), api.getPolicyConfig()]);
  if (auditR.status === 'rejected') {
    return (
      <PageScroll>
        <PageHeader title="Security events" subtitle="Tool calls the guardrails stopped." />
        <Unreachable resource="security events" />
      </PageScroll>
    );
  }
  const events = denyEventsOf(auditR.value);
  const semanticOn = configR.status === 'fulfilled' ? configR.value.semanticFirewall : false;

  return (
    <PageScroll>
      <PageHeader
        title="Security events"
        subtitle="Tool calls the guardrails stopped — injections, blocked tools, budget and approval denials."
        actions={
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
              semanticOn ? 'bg-allow-soft text-allow' : 'bg-secondary text-muted-foreground',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', semanticOn ? 'bg-allow' : 'bg-muted-foreground')} aria-hidden />
            Semantic firewall {semanticOn ? 'ON' : 'OFF'}
          </span>
        }
      />

      {events.length === 0 ? (
        <StateBlock
          icon={ShieldAlert}
          title="No blocked calls yet"
          body="Run a red-team scenario in the console — injection attempts, blocked tools, and budget/approval denials land here."
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {events.map((ev) => (
            <li key={ev.sequence} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
              <ShieldX className="h-4 w-4 shrink-0 text-deny" aria-hidden />
              <span className="rounded-full bg-deny-soft px-2 py-0.5 text-xs font-medium text-deny">{ev.layer}</span>
              <span className="font-mono text-sm font-medium">{ev.tool}</span>
              <span className="text-xs text-muted-foreground">{ev.reason}</span>
              <span className="ml-auto flex items-center gap-3 font-mono text-xs text-muted-foreground">
                {ev.conversationId && (
                  <Link href={`/audit?conversationId=${encodeURIComponent(ev.conversationId)}`} className="text-primary hover:underline">
                    {truncateMiddle(ev.conversationId)}
                  </Link>
                )}
                {formatTime(ev.timestamp)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </PageScroll>
  );
}
