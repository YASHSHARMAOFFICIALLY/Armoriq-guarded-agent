'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, LayoutDashboard, Plug, ScrollText, ShieldAlert, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/cn';

const NAV = [
  { href: '/', label: 'Live Console', icon: Activity },
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/rules', label: 'Policies', icon: ShieldCheck },
  { href: '/audit', label: 'Audit Log', icon: ScrollText },
  { href: '/security', label: 'Security', icon: ShieldAlert },
  { href: '/tools', label: 'Tools', icon: Plug },
] as const;

export function Nav({ orientation = 'vertical' }: { orientation?: 'vertical' | 'horizontal' }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className={cn(orientation === 'vertical' ? 'flex flex-col gap-0.5' : 'flex gap-1 overflow-x-auto')}
    >
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
              active
                ? 'bg-accent font-medium text-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <Icon
              className={cn(
                'h-4 w-4 shrink-0',
                active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
              )}
              aria-hidden
            />
            <span className="whitespace-nowrap">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
