'use client';

import { Loader2, ShieldCheck, ShieldX } from 'lucide-react';
import { useState } from 'react';
import { verifyAttestation } from '@/lib/verify-signature';
import type { Attestation } from '@/lib/types';

// "✓ attested" + a one-click signature verification. The whole point: a reviewer can confirm, in the
// browser, that this exact verdict was signed by the policy engine and hasn't been altered.
export function AttestationBadge({ attestation }: { attestation: Attestation }) {
  const [state, setState] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');

  async function verify() {
    setState('checking');
    setState((await verifyAttestation(attestation)) ? 'valid' : 'invalid');
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span
        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
        title={`Signed by the policy engine · ${attestation.alg} · keyId ${attestation.keyId}`}
      >
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> attested
      </span>
      <button
        type="button"
        onClick={verify}
        disabled={state === 'checking'}
        className="text-xs text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50"
      >
        {state === 'checking' ? <Loader2 className="inline h-3 w-3 animate-spin" aria-hidden /> : 'verify signature'}
      </button>
      {state === 'valid' && (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-allow">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> signature valid
        </span>
      )}
      {state === 'invalid' && (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-deny">
          <ShieldX className="h-3.5 w-3.5" aria-hidden /> signature invalid
        </span>
      )}
    </span>
  );
}
