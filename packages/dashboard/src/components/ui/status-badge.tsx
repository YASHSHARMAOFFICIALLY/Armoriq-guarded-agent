import { Check, Clock, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { DecisionStatus } from '@/lib/types';

const MAP: Record<DecisionStatus, { label: string; cls: string; Icon: typeof Check }> = {
  ALLOW: { label: 'Allowed', cls: 'text-allow bg-allow-soft', Icon: Check },
  DENY: { label: 'Denied', cls: 'text-deny bg-deny-soft', Icon: X },
  PENDING_APPROVAL: { label: 'Pending', cls: 'text-pending bg-pending-soft', Icon: Clock },
};

export function StatusBadge({
  status,
  className,
  withIcon = true,
}: {
  status: DecisionStatus;
  className?: string;
  withIcon?: boolean;
}) {
  const { label, cls, Icon } = MAP[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        cls,
        className,
      )}
    >
      {withIcon && <Icon className="h-3.5 w-3.5" aria-hidden />}
      {label}
    </span>
  );
}

// A neutral pill for non-decision metadata (event types, rule types, counts).
export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground',
        className,
      )}
    >
      {children}
    </span>
  );
}
