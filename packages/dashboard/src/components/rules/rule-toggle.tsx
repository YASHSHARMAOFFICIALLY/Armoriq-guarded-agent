'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

// Enable/disable a rule live. The engine re-reads rules every turn, so flipping this changes the
// running agent's behavior with no restart. Optimistic, with rollback on failure.
export function RuleToggle({ ruleId, enabled }: { ruleId: string; enabled: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !on;
    setOn(next);
    setBusy(true);
    try {
      await api.toggleRule(ruleId, next);
      router.refresh();
    } catch {
      setOn(!next); // rollback
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={on ? 'Disable rule' : 'Enable rule'}
        disabled={busy}
        onClick={toggle}
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50',
          on ? 'bg-allow' : 'bg-muted-foreground/40',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
            on ? 'translate-x-[1.125rem]' : 'translate-x-0.5',
          )}
        />
      </button>
      <span className={cn('text-xs font-medium', on ? 'text-allow' : 'text-muted-foreground')}>
        {on ? 'Enabled' : 'Disabled'}
      </span>
    </span>
  );
}
