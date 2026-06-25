import { Plug } from 'lucide-react';
import { ToolCard } from '@/components/tools/tool-card';
import { PageHeader, PageScroll } from '@/components/ui/page';
import { StateBlock } from '@/components/ui/state-block';
import { Unreachable } from '@/components/ui/unreachable';
import { api } from '@/lib/api';
import type { McpTool } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ToolsPage() {
  let tools: McpTool[] | null = null;
  try {
    tools = await api.getTools();
  } catch {
    tools = null;
  }

  const servers = tools ? [...new Set(tools.map((t) => t.serverId).filter(Boolean))] : [];

  return (
    <PageScroll>
      <PageHeader
        title="Tools"
        subtitle="Tools exposed by connected MCP servers — the actions the agent can propose."
        actions={
          servers.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {servers.length} server{servers.length === 1 ? '' : 's'} connected
            </span>
          ) : undefined
        }
      />

      {tools === null ? (
        <Unreachable resource="the tool catalog" />
      ) : tools.length === 0 ? (
        <StateBlock
          icon={Plug}
          title="No tools available"
          body="No MCP servers are reporting tools. Check that the server has its MCP servers connected."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((t) => (
            <ToolCard key={`${t.serverId ?? ''}:${t.name}`} tool={t} />
          ))}
        </div>
      )}
    </PageScroll>
  );
}
