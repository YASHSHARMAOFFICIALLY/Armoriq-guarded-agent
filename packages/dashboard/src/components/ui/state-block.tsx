import { cn } from '@/lib/cn';
import type { LucideIcon } from 'lucide-react';

// Reusable empty / error / unreachable block (see states.md: every data view needs these).
export function StateBlock({
  icon: Icon,
  title,
  body,
  action,
  tone = 'default',
  className,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
  tone?: 'default' | 'error';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center',
        tone === 'error' ? 'border-deny/30 bg-deny-soft' : 'border-border bg-card/50',
        className,
      )}
    >
      <Icon
        className={cn('h-8 w-8', tone === 'error' ? 'text-deny' : 'text-muted-foreground')}
        aria-hidden
      />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {body && <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground">{body}</p>}
      </div>
      {action}
    </div>
  );
}
