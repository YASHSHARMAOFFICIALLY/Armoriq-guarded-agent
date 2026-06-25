import { PageScroll } from './page';
import { Skeleton } from './skeleton';

// Shown via Next's loading.tsx convention while a data page's server fetch runs.
// The real title stays for orientation; everything data-shaped is a skeleton.
export function PageSkeleton({ title, rows = 5 }: { title: string; rows?: number }) {
  return (
    <PageScroll>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </PageScroll>
  );
}
