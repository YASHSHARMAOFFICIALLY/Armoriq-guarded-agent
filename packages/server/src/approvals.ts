import type { Rule, ToolCallProposal } from '@armoriq/shared';

interface Pending {
  resolve: (verdict: 'ALLOW' | 'DENY') => void;
  proposal: ToolCallProposal;
  timer: ReturnType<typeof setTimeout>;
}

// Holds tool calls awaiting human approval. A turn parks on waitForApproval(); the API resolves it
// when a human responds, or the per-rule timeout fires the configured fallback.
// ponytail: in-memory map — a server restart drops pending approvals (they'd re-propose on retry).
export class ApprovalRegistry {
  private readonly pending = new Map<string, Pending>();

  waitForApproval(
    proposal: ToolCallProposal,
    rule: Rule | undefined,
    approvalId: string,
  ): Promise<'ALLOW' | 'DENY'> {
    const timeoutSeconds = rule?.type === 'REQUIRE_APPROVAL' ? rule.config.timeoutSeconds : 60;
    const fallback: 'ALLOW' | 'DENY' =
      rule?.type === 'REQUIRE_APPROVAL' && rule.config.approverFallback === 'AUTO_ALLOW' ? 'ALLOW' : 'DENY';

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(approvalId);
        resolve(fallback);
      }, timeoutSeconds * 1000);
      timer.unref?.(); // don't keep the process alive solely for a pending approval
      this.pending.set(approvalId, { resolve, proposal, timer });
    });
  }

  // Called by the API when a human approves/denies. Returns false if the id isn't pending.
  resolve(approvalId: string, verdict: 'ALLOW' | 'DENY'): boolean {
    const entry = this.pending.get(approvalId);
    if (!entry) return false;
    clearTimeout(entry.timer);
    this.pending.delete(approvalId);
    entry.resolve(verdict);
    return true;
  }

  list(): Array<{ approvalId: string; proposal: ToolCallProposal }> {
    return [...this.pending.entries()].map(([approvalId, p]) => ({ approvalId, proposal: p.proposal }));
  }
}
