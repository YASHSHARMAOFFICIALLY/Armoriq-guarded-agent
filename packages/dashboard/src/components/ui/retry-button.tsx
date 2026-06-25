'use client';

import { RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from './button';

// Re-runs the server component fetch. Used by the "server unreachable" state.
export function RetryButton() {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);
  return (
    <Button
      variant="secondary"
      onClick={() => {
        setSpinning(true);
        router.refresh();
        setTimeout(() => setSpinning(false), 600);
      }}
    >
      <RotateCcw className={spinning ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden />
      Try again
    </Button>
  );
}
