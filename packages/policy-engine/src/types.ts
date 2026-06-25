// Current resource usage for the scope the caller cares about (per-conversation or global).
// The policy engine never stores this — the caller measures it and passes a snapshot in,
// which keeps budget evaluation pure and trivially testable.
export interface UsageSnapshot {
  tokensUsed: number;
  toolCallsMade: number;
}
