'use client';

import { ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

type Health = 'checking' | 'online' | 'offline';
type Chain =
  | { state: 'checking' }
  | { state: 'valid' }
  | { state: 'broken'; at?: number }
  | { state: 'unknown' };

// Top-bar liveness: is the server up, and is the audit chain intact? Polled every 15s.
export function StatusIndicators({ compact = false }: { compact?: boolean }) {
  const [health, setHealth] = useState<Health>('checking');
  const [chain, setChain] = useState<Chain>({ state: 'checking' });

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        await api.health();
        if (!alive) return;
        setHealth('online');
      } catch {
        if (!alive) return;
        setHealth('offline');
        setChain({ state: 'unknown' });
        return;
      }
      try {
        const r = await api.verifyAudit();
        if (!alive) return;
        setChain(r.valid ? { state: 'valid' } : { state: 'broken', at: r.brokenAtSequence });
      } catch {
        if (alive) setChain({ state: 'unknown' });
      }
    }
    void tick();
    const id = setInterval(tick, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const healthDot =
    health === 'online' ? 'bg-allow' : health === 'offline' ? 'bg-deny' : 'bg-muted-foreground';
  const healthLabel = health === 'online' ? 'Server online' : health === 'offline' ? 'Server offline' : 'Connecting…';

  const ChainIcon =
    chain.state === 'valid' ? ShieldCheck : chain.state === 'broken' ? ShieldAlert : ShieldQuestion;
  const chainColor =
    chain.state === 'valid' ? 'text-allow' : chain.state === 'broken' ? 'text-deny' : 'text-muted-foreground';
  const chainLabel =
    chain.state === 'valid'
      ? 'Chain verified'
      : chain.state === 'broken'
        ? `Chain broken${chain.at != null ? ` @ #${chain.at}` : ''}`
        : chain.state === 'checking'
          ? 'Verifying chain…'
          : 'Chain unknown';

  return (
    <div className="flex items-center gap-4 text-xs">
      <span className="inline-flex items-center gap-2" title={healthLabel}>
        <span className={cn('h-2 w-2 rounded-full', healthDot, health === 'online' && 'animate-pulse')} aria-hidden />
        {!compact && <span className="text-muted-foreground">{healthLabel}</span>}
        <span className="sr-only">{healthLabel}</span>
      </span>
      <span className={cn('inline-flex items-center gap-1.5', chainColor)} title={chainLabel}>
        <ChainIcon className="h-4 w-4" aria-hidden />
        {!compact && <span className="font-medium">{chainLabel}</span>}
        <span className="sr-only">{chainLabel}</span>
      </span>
    </div>
  );
}
