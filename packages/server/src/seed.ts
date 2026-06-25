import { prisma } from './db.js';
import { seedRulesIfEmpty } from './rules.js';

async function main(): Promise<void> {
  await seedRulesIfEmpty();
  console.error(`rules in DB: ${await prisma.rule.count()}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
