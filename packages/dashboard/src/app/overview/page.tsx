import { Activity, ExternalLink, Fingerprint, Gavel, ScanEye, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi';
import { PageScroll } from '@/components/ui/page';
import { Unreachable } from '@/components/ui/unreachable';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatCount, formatTime } from '@/lib/format';
import type { AuditEntry, AuditEventType, McpTool } from '@/lib/types';

export const dynamic = 'force-dynamic';

const EVENT_CLS: Record<AuditEventType, string> = {
  PROPOSAL: 'bg-secondary text-secondary-foreground',
  DECISION: 'bg-primary/10 text-primary',
  EXECUTION: 'bg-allow-soft text-allow',
  APPROVAL: 'bg-pending-soft text-pending',
};

// DECISION payload shape isn't strongly typed across the chain — read defensively.
function decisionStatusOf(payload: unknown): 'ALLOW' | 'DENY' | 'PENDING_APPROVAL' | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const nested = (p.decision as Record<string, unknown> | undefined)?.status;
  const v = p.status ?? nested;
  return v === 'ALLOW' || v === 'DENY' || v === 'PENDING_APPROVAL' ? v : null;
}

// The three layers of defense — neutral by design (decision colors are reserved for ALLOW/DENY/pending).
const LAYERS = [
  { icon: Gavel, title: 'Deterministic rules', body: 'Block, approve, validate, and budget tools. Fixed precedence — DENY beats approval.' },
  { icon: ScanEye, title: 'Semantic firewall', body: "An LLM judge catches injection hijacks a static rule can't. Fails open." },
  { icon: Fingerprint, title: 'Signed + tamper-evident', body: 'Every verdict is Ed25519-signed and hash-chained. Nothing is altered after the fact.' },
] as const;

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

// Project intro for anyone who lands here cold (incl. the deployed link). Static — also rendered when
// the server is unreachable, so the page always explains itself instead of just showing an error.
function IntroHero() {
  return (
    <section className="rounded-lg border border-border bg-card p-6 md:p-8">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
        ArmorIQ · Guarded Agent
      </div>

      <h1 className="mt-3 max-w-2xl text-balance text-xl font-semibold tracking-tight md:text-2xl">
        A policy layer between an LLM agent and its tools
      </h1>

      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Every tool call the agent proposes is evaluated in real time —{' '}
        <span className="font-medium text-allow">ALLOW</span>,{' '}
        <span className="font-medium text-deny">DENY</span>, or held for{' '}
        <span className="font-medium text-pending">approval</span> — then the verdict is
        cryptographically signed and written to a tamper-evident audit chain. The policy engine is the
        heart; the agent only ever proposes.
      </p>

      <ul className="mt-5 grid gap-3 sm:grid-cols-3">
        {LAYERS.map((l, i) => (
          <li key={l.title} className="rounded-md border border-border bg-background p-3">
            <div className="flex items-center gap-2">
              <l.icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="text-xs font-semibold">
                {i + 1}. {l.title}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{l.body}</p>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Link href="/" className={buttonClass({ variant: 'primary', className: FOCUS_RING })}>
          <Activity className="h-4 w-4" aria-hidden />
          Open live console
        </Link>
        <a
          href="https://github.com/YASHSHARMAOFFICIALLY/Armoriq-guarded-agent"
          target="_blank"
          rel="noreferrer"
          className={buttonClass({ variant: 'secondary', className: FOCUS_RING })}
        >
          GitHub
          <ExternalLink className="h-3.5 w-3.5 opacity-60" aria-hidden />
        </a>
      </div>
    </section>
  );
}

export default async function OverviewPage() {
  const [auditR, toolsR, verifyR] = await Promise.allSettled([
    api.getAudit(),
    api.getTools(),
    api.verifyAudit(),
  ]);

  // Both core reads failing means the server is unreachable.
  if (auditR.status === 'rejected' && toolsR.status === 'rejected') {
    return (
      <PageScroll>
        <IntroHero />
        <div className="mt-6">
          <Unreachable resource="overview data" />
        </div>
      </PageScroll>
    );
  }

  const entries: AuditEntry[] = auditR.status === 'fulfilled' ? auditR.value : [];
  const tools: McpTool[] = toolsR.status === 'fulfilled' ? toolsR.value : [];
  const verify = verifyR.status === 'fulfilled' ? verifyR.value : null;

  let allow = 0;
  let deny = 0;
  let pending = 0;
  let executions = 0;
  for (const e of entries) {
    if (e.eventType === 'EXECUTION') executions++;
    if (e.eventType === 'DECISION') {
      const s = decisionStatusOf(e.payload);
      if (s === 'ALLOW') allow++;
      else if (s === 'DENY') deny++;
      else if (s === 'PENDING_APPROVAL') pending++;
    }
  }
  const decisionTotal = allow + deny + pending;
  const recent = [...entries].sort((a, b) => b.sequence - a.sequence).slice(0, 8);

  return (
    <PageScroll>
      <IntroHero />

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Decisions"
          value={formatCount(decisionTotal)}
          sub={
            <span className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono">
              <span className="text-allow">{allow} allow</span>
              <span className="text-deny">{deny} deny</span>
              <span className="text-pending">{pending} pending</span>
            </span>
          }
        />
        <KpiCard label="Audit entries" value={formatCount(entries.length)} sub={`${formatCount(executions)} executions`} />
        <KpiCard label="Tools" value={formatCount(tools.length)} sub="available to the agent" />
        <KpiCard
          label="Chain integrity"
          value={
            verify ? (
              <span className={cn('text-base', verify.valid ? 'text-allow' : 'text-deny')}>
                {verify.valid ? 'Verified' : 'Broken'}
              </span>
            ) : (
              <span className="text-base text-muted-foreground">—</span>
            )
          }
          sub={
            verify && !verify.valid && verify.brokenAtSequence != null
              ? `broken at #${verify.brokenAtSequence}`
              : 'tamper-evident'
          }
        />
      </div>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-semibold">Recent activity</h2>
        {recent.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
            No activity yet. Run a turn in the{' '}
            <Link href="/" className="text-primary hover:underline">
              console
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {recent.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">{e.sequence}</span>
                <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', EVENT_CLS[e.eventType])}>
                  {e.eventType}
                </span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">{formatTime(e.timestamp)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/audit" className="mt-2 inline-block text-xs text-primary hover:underline">
          View full audit log →
        </Link>
      </section>
    </PageScroll>
  );
}
