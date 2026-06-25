import { ShieldHalf } from 'lucide-react';
import { Nav } from './nav';
import { StatusIndicators } from './status-indicators';
import { ThemeToggle } from './theme-toggle';

// Persistent chrome: left sidebar (md+), top bar with live status + theme, and a
// horizontal nav fallback on small screens. Sidebar stays in the 240–320px band.
export function AppShell({ children }: { children: React.ReactNode }) {
  // md:grid-rows-1 -> grid-template-rows: minmax(0,1fr): pins the row to the viewport so it can't grow
  // to content height (an auto row balloons and breaks every page's inner scroll).
  return (
    <div className="h-dvh overflow-hidden md:grid md:grid-cols-[15rem_1fr] md:grid-rows-1">
      <aside className="hidden border-r border-border bg-card/40 md:flex md:flex-col">
        <div className="flex h-14 items-center gap-2 border-b border-border px-5">
          <ShieldHalf className="h-5 w-5 text-primary" aria-hidden />
          <span className="font-semibold tracking-tight">ArmorIQ</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <Nav />
        </div>
        <p className="border-t border-border px-5 py-4 text-xs text-muted-foreground">Guardrail console</p>
      </aside>

      <div className="flex h-full min-w-0 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <ShieldHalf className="h-5 w-5 text-primary" aria-hidden />
            <span className="font-semibold tracking-tight">ArmorIQ</span>
          </div>
          <div className="hidden md:block">
            <StatusIndicators />
          </div>
          <div className="flex items-center gap-2">
            <div className="md:hidden">
              <StatusIndicators compact />
            </div>
            <ThemeToggle />
          </div>
        </header>

        <div className="shrink-0 border-b border-border px-2 py-2 md:hidden">
          <Nav orientation="horizontal" />
        </div>

        <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
