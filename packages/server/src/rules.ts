import { RuleSchema } from '@armoriq/shared';
import type { Rule } from '@armoriq/shared';
import { prisma } from './db.js';

// Loads active rules and validates each row with the shared zod schema — this is the trust boundary
// where DB-stored config becomes a typed, discriminated Rule.
export async function loadRules(): Promise<Rule[]> {
  const rows = await prisma.rule.findMany();
  return rows.map((row) => RuleSchema.parse(row));
}

// Demo policy set targeting the security-ops tools. Seeded once on first boot.
const DEMO_RULES: Rule[] = [
  {
    id: 'rule-approve-block-ip',
    type: 'REQUIRE_APPROVAL',
    toolName: 'block_ip',
    enabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    config: { approverFallback: 'AUTO_DENY', timeoutSeconds: 120 },
  },
  {
    id: 'rule-incident-details-length',
    type: 'INPUT_VALIDATION',
    toolName: 'create_incident',
    enabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    config: { field: 'details', maxLength: 2000 },
  },
  {
    id: 'rule-conversation-budget',
    type: 'BUDGET_LIMIT',
    toolName: '*',
    enabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    config: { maxToolCalls: 10, scope: 'CONVERSATION' },
  },
];

export async function seedRulesIfEmpty(): Promise<void> {
  if ((await prisma.rule.count()) > 0) return;
  for (const rule of DEMO_RULES) {
    await prisma.rule.create({ data: { ...rule, config: rule.config as object } });
  }
}
