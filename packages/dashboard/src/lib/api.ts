// Typed client for the ArmorIQ server (Express, see packages/server/src/app.ts).
// Works from both Server Components (Node) and Client Components (browser); the
// server sets CORS origin '*' so direct browser calls to :4000 are allowed.
// Override the target with NEXT_PUBLIC_API_URL.

import type { AuditEntry, McpTool, Rule, TurnResult, VerifyResult } from './types';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      cache: 'no-store', // live operator data — never serve stale
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
      ...init,
    });
  } catch {
    throw new ApiError(`Can't reach the ArmorIQ server at ${API_BASE}. Is it running?`);
  }
  if (!res.ok) {
    let detail = '';
    try {
      detail = ((await res.json()) as { error?: string }).error ?? '';
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(detail || `Request failed (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

export const api = {
  base: API_BASE,

  health: () => request<{ ok: boolean }>('/health'),

  getTools: () => request<{ tools: McpTool[] }>('/tools').then((r) => r.tools),

  getRules: () => request<{ rules: Rule[] }>('/rules').then((r) => r.rules),

  createRule: (rule: Rule) =>
    request<{ rule: Rule }>('/rules', { method: 'POST', body: JSON.stringify(rule) }).then((r) => r.rule),

  toggleRule: (id: string, enabled: boolean) =>
    request<{ rule: Rule }>(`/rules/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }).then((r) => r.rule),

  getAudit: (conversationId?: string) =>
    request<{ entries: AuditEntry[] }>(
      `/audit${conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : ''}`,
    ).then((r) => r.entries),

  verifyAudit: () => request<VerifyResult>('/audit/verify'),

  getPubkey: () =>
    request<{ alg: string; keyId: string; publicKeyPem: string; publicKeyDerB64: string }>('/policy/pubkey'),

  getPolicyConfig: () => request<{ semanticFirewall: boolean }>('/policy/config'),

  verifyAttestationOnServer: (attestation: unknown) =>
    request<{ valid: boolean }>('/policy/verify', {
      method: 'POST',
      body: JSON.stringify({ attestation }),
    }).then((r) => r.valid),

  respondApproval: (approvalId: string, decision: 'ALLOW' | 'DENY') =>
    request<{ ok: boolean }>(`/approvals/${encodeURIComponent(approvalId)}`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }),

  sendMessage: (conversationId: string, message: string) =>
    request<TurnResult>(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
};
