/** A rule applies to a proposal when its toolName is the wildcard '*' or matches exactly. */
export function toolMatches(ruleToolName: string, proposalToolName: string): boolean {
  return ruleToolName === '*' || ruleToolName === proposalToolName;
}
