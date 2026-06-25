import { CircuitBreaker } from '@armoriq/policy-engine';
import { createApp } from './app.js';
import { createRegistry, connectConfiguredServers } from './mcp.js';
import { ApprovalRegistry } from './approvals.js';
import { seedRulesIfEmpty } from './rules.js';
import { prisma } from './db.js';

const PORT = Number(process.env.PORT ?? 4000);

async function main(): Promise<void> {
  await prisma.$connect();
  await seedRulesIfEmpty();

  // ONE breaker instance shared by the policy engine (isOpen) and the registry's transport hooks.
  const circuitBreaker = new CircuitBreaker();
  const registry = createRegistry(circuitBreaker);
  await connectConfiguredServers(registry);

  const approvals = new ApprovalRegistry();
  const { http } = createApp({ registry, circuitBreaker, approvals });
  http.listen(PORT, () => console.error(`armoriq guarded-agent server listening on :${PORT}`));
}

main().catch((err) => {
  console.error('failed to start:', err);
  process.exit(1);
});
