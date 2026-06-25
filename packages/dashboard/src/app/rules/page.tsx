import { ShieldCheck } from 'lucide-react';
import { CreateRuleDialog } from '@/components/rules/create-rule-dialog';
import { RulesList } from '@/components/rules/rules-list';
import { PageHeader, PageScroll } from '@/components/ui/page';
import { StateBlock } from '@/components/ui/state-block';
import { Unreachable } from '@/components/ui/unreachable';
import { api } from '@/lib/api';
import type { Rule } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function RulesPage() {
  let rules: Rule[] | null = null;
  try {
    rules = await api.getRules();
  } catch {
    rules = null;
  }

  return (
    <PageScroll>
      <PageHeader
        title="Policies"
        subtitle="Rules evaluated against every tool call the agent proposes."
        actions={<CreateRuleDialog />}
      />

      {rules === null ? (
        <Unreachable resource="policy rules" />
      ) : rules.length === 0 ? (
        <StateBlock
          icon={ShieldCheck}
          title="No rules yet"
          body="With no rules, every proposed tool call is allowed. Add a rule to start guarding."
          action={<CreateRuleDialog />}
        />
      ) : (
        <>
          <RulesList rules={rules} />
          <p className="mt-6 text-xs text-muted-foreground">
            Creating or toggling a rule takes effect on the running agent immediately — no restart. The
            engine re-reads the active rule set on every turn.
          </p>
        </>
      )}
    </PageScroll>
  );
}
