import { ServerOff } from 'lucide-react';
import { API_BASE } from '@/lib/api';
import { RetryButton } from './retry-button';
import { StateBlock } from './state-block';

// Shown when a server-component fetch can't reach the ArmorIQ backend.
export function Unreachable({ resource }: { resource: string }) {
  return (
    <StateBlock
      tone="error"
      icon={ServerOff}
      title="Can't reach the ArmorIQ server"
      body={`Couldn't load ${resource} from ${API_BASE}. Start the server (packages/server) and Postgres, then retry.`}
      action={<RetryButton />}
    />
  );
}
