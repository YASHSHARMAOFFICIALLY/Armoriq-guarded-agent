import { ScrollText } from 'lucide-react';
import { AuditTable } from '@/components/audit/audit-table';
import { VerifyChainButton } from '@/components/audit/verify-chain-button';
import { PageHeader, PageScroll } from '@/components/ui/page';
import { StateBlock } from '@/components/ui/state-block';
import { Unreachable } from '@/components/ui/unreachable';
import { api } from '@/lib/api';
import { truncateMiddle } from '@/lib/format';
import type { AuditEntry } from '@/lib/types';

export const dynamic = 'force-dynamic';

// searchParams is async in Next 16.
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ conversationId?: string }>;
}) {
  const { conversationId } = await searchParams;

  let entries: AuditEntry[] | null = null;
  try {
    entries = await api.getAudit(conversationId);
  } catch {
    entries = null;
  }

  const subtitle = conversationId
    ? `Filtered to conversation ${truncateMiddle(conversationId)}`
    : 'Tamper-evident, hash-chained record of every proposal, decision, execution, and approval.';

  return (
    <PageScroll>
      <PageHeader title="Audit Log" subtitle={subtitle} actions={<VerifyChainButton />} />

      {entries === null ? (
        <Unreachable resource="the audit log" />
      ) : entries.length === 0 ? (
        <StateBlock
          icon={ScrollText}
          title={conversationId ? 'No entries for this conversation' : 'No audit entries yet'}
          body="Run a turn in the Live Console — every proposal, decision, execution, and approval is recorded here."
        />
      ) : (
        <AuditTable entries={entries} />
      )}
    </PageScroll>
  );
}
