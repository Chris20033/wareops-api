import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function collectTypeScriptFiles(dir: string): string[] {
  const results: string[] = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (
        entry === 'generated' ||
        entry === 'node_modules' ||
        entry === 'dist'
      ) {
        continue;
      }
      results.push(...collectTypeScriptFiles(fullPath));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
      results.push(fullPath);
    }
  }

  return results;
}

describe('ADR-006 Prisma-only data access invariant', () => {
  it('never uses raw SQL methods or TypedSQL in src/ or prisma/', () => {
    const forbiddenTokens = [
      '$queryRaw',
      '$queryRawUnsafe',
      '$executeRaw',
      '$executeRawUnsafe',
    ];
    const files = [
      ...collectTypeScriptFiles(join(process.cwd(), 'src')),
      ...collectTypeScriptFiles(join(process.cwd(), 'prisma')),
    ];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const token of forbiddenTokens) {
        expect(content).not.toContain(token);
      }
    }
  });
});
