'use client';

import { Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

type Result = { valid: true } | { valid: false; at?: number } | { error: string };

// On-demand cryptographic verification of the whole audit chain. This is the
// trust centerpiece — the result is stated plainly and with authority.
export function VerifyChainButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function verify() {
    setBusy(true);
    setResult(null);
    try {
      const r = await api.verifyAudit();
      setResult(r.valid ? { valid: true } : { valid: false, at: r.brokenAtSequence });
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : 'Verification failed.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && 'valid' in result && result.valid && (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-allow">
          <ShieldCheck className="h-4 w-4" aria-hidden />
          Chain verified
        </span>
      )}
      {result && 'valid' in result && !result.valid && (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-deny">
          <ShieldAlert className="h-4 w-4" aria-hidden />
          Broken{result.at != null ? ` at #${result.at}` : ''}
        </span>
      )}
      {result && 'error' in result && <span className="text-sm text-deny">{result.error}</span>}
      <Button variant="secondary" onClick={verify} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
        Verify chain
      </Button>
    </div>
  );
}
