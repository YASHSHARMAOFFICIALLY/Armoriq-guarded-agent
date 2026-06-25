// Tiny class joiner. No tailwind-merge — we don't generate conflicting utilities,
// so a filter+join is all this needs.
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
