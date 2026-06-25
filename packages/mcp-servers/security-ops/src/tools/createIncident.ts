import { randomUUID } from 'node:crypto';
import type { ToolDefinition } from './shared.js';
import { requireString } from './shared.js';

const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
type Severity = (typeof SEVERITIES)[number];
const MAX_DETAILS_LENGTH = 5000;

interface Incident {
  id: string;
  title: string;
  severity: Severity;
  details: string;
  status: 'OPEN';
  createdAt: string;
}

// Module-local incident store. Persisting isn't strictly required (the tool returns the created
// incident), but keeping them lets the server behave like a real incident queue.
const incidents: Incident[] = [];

export const createIncident: ToolDefinition = {
  name: 'create_incident',
  description: 'Open a security incident with a severity and details.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short incident title.' },
      severity: { type: 'string', enum: [...SEVERITIES], description: 'Incident severity.' },
      details: { type: 'string', description: `Free-text details (max ${MAX_DETAILS_LENGTH} chars).` },
    },
    required: ['title', 'severity', 'details'],
  },
  handler: (args) => {
    const title = requireString(args, 'title');
    const severity = requireString(args, 'severity');
    const details = requireString(args, 'details');
    // Defense in depth: validate the enum and length here even though the policy engine also does.
    if (!SEVERITIES.includes(severity as Severity)) {
      throw new Error(`Invalid severity: ${severity} (expected one of ${SEVERITIES.join(', ')})`);
    }
    if (details.length > MAX_DETAILS_LENGTH) {
      throw new Error(`details too long: ${details.length} chars exceeds max ${MAX_DETAILS_LENGTH}`);
    }
    const incident: Incident = {
      id: randomUUID(),
      title,
      severity: severity as Severity,
      details,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
    };
    incidents.push(incident);
    return incident;
  },
};
