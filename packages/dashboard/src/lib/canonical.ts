// Mirrors packages/audit/src/hashChain.ts `canonicalStringify` EXACTLY. Used to reconstruct the
// bytes the policy engine signed, so the browser can verify a decision signature itself.
// (Kept as a tiny local copy rather than importing the server package into the client bundle.)
export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const body = Object.keys(obj)
    .sort()
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`)
    .join(',');
  return `{${body}}`;
}
