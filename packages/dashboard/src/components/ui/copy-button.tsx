'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { copy } from '@/lib/format';

// Copy a machine value (hash, id, ip). Shows a brief check on success.
export function CopyButton({ value, label, className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label ?? `Copy ${value}`}
      onClick={async () => {
        await copy(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className={cn(
        'inline-grid h-6 w-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        className,
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-allow" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
    </button>
  );
}

// A monospace value + inline copy affordance, middle-truncated by the caller.
export function MonoCopy({ display, value, className }: { display: string; value: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span className="font-mono text-xs">{display}</span>
      <CopyButton value={value} />
    </span>
  );
}
