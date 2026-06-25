import { relativeTime } from '@/lib/format';
import type { Rule } from '@/lib/types';
import { RULE_META, RULE_TYPE_ORDER, configSummary } from './rule-meta';
import { RuleToggle } from './rule-toggle';

// Server-rendered list, grouped by rule type. The enable/disable switch is a client island.
export function RulesList({ rules }: { rules: Rule[] }) {
  const groups = RULE_TYPE_ORDER.map((type) => ({
    type,
    items: rules.filter((r) => r.type === type),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      {groups.map(({ type, items }) => {
        const meta = RULE_META[type];
        const Icon = meta.icon;
        return (
          <section key={type}>
            <div className="mb-2 flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
              <h2 className="text-sm font-semibold">{meta.label}</h2>
              <span className="font-mono text-xs text-muted-foreground">{items.length}</span>
            </div>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {items.map((rule) => (
                <li key={rule.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3">
                  <span className="font-mono text-sm font-medium">
                    {rule.toolName === '*' ? <span className="text-muted-foreground">all tools</span> : rule.toolName}
                  </span>
                  <RuleToggle ruleId={rule.id} enabled={rule.enabled} />
                  <span className="text-xs text-muted-foreground">{configSummary(rule)}</span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">{relativeTime(rule.createdAt)}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
