import type { Decision, ToolCallProposal } from '@armoriq/shared';

// ─────────────────────────────────────────────────────────────────────────────
// HEURISTIC, NOT A GUARANTEE.
// A cheap, best-effort string scan for the most common prompt-injection and
// command-injection tells. It WILL miss obfuscated or novel attacks and WILL
// occasionally false-positive on benign text. Treat it as one defense-in-depth
// layer, never as a security boundary. Tune the pattern lists as attacks evolve.
// ─────────────────────────────────────────────────────────────────────────────

const INJECTION_PHRASES: RegExp[] = [
  /ignore\s+(all\s+|any\s+)?(previous|prior|above|earlier)\s+instructions/i,
  /disregard\s+(the\s+)?(previous|prior|above|system|all)/i,
  /system\s+prompt/i,
  /you\s+are\s+now\b/i,
  /developer\s+mode/i,
  /override\s+(the\s+)?(rules|policy|policies|safety|guardrails)/i,
];

// Shell metacharacters that strongly suggest an attempt at command injection inside an
// argument value. False-positive prone for tools that legitimately take shell-ish input —
// hence "heuristic". A schema-aware check belongs at the tool boundary, not here.
const SHELL_METACHARACTERS = /[;`|<>]|\$\(|&&/;

export function checkInjectionHeuristic(proposal: ToolCallProposal): Decision | null {
  const reasoning = proposal.reasoning ?? '';
  const argsText = safeStringify(proposal.args);

  for (const phrase of INJECTION_PHRASES) {
    if (phrase.test(reasoning) || phrase.test(argsText)) {
      return {
        status: 'DENY',
        reason: `Injection heuristic: suspicious instruction-override phrase (heuristic, not a guarantee)`,
      };
    }
  }

  if (SHELL_METACHARACTERS.test(argsText)) {
    return {
      status: 'DENY',
      reason: 'Injection heuristic: argument contains shell metacharacters (heuristic, not a guarantee)',
    };
  }

  return null;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
}
