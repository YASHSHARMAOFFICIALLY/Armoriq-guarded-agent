import { Tag } from '@/components/ui/status-badge';
import type { McpTool } from '@/lib/types';

interface PropRow {
  name: string;
  type?: string;
  required: boolean;
  description?: string;
}

// Pull a readable parameter list out of a JSON Schema, if it looks like one.
function schemaProps(schema: unknown): PropRow[] | null {
  if (!schema || typeof schema !== 'object') return null;
  const s = schema as Record<string, unknown>;
  const props = s.properties;
  if (!props || typeof props !== 'object') return null;
  const required = new Set<string>(Array.isArray(s.required) ? (s.required as string[]) : []);
  return Object.entries(props as Record<string, unknown>).map(([name, raw]) => {
    const def = (raw ?? {}) as Record<string, unknown>;
    const type = Array.isArray(def.enum)
      ? (def.enum as unknown[]).map(String).join(' | ')
      : typeof def.type === 'string'
        ? def.type
        : undefined;
    return {
      name,
      type,
      required: required.has(name),
      description: typeof def.description === 'string' ? def.description : undefined,
    };
  });
}

export function ToolCard({ tool }: { tool: McpTool }) {
  const props = schemaProps(tool.inputSchema);
  return (
    <article className="flex flex-col rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-mono text-sm font-medium">{tool.name}</h3>
        {tool.serverId && <Tag className="font-mono">{tool.serverId}</Tag>}
      </div>
      {/* Discovered description shown verbatim, clamped to 3 lines (remote servers ship long ones).
          Native <details> so it's keyboard-toggleable with no JS; the full text is never altered. */}
      {tool.description && (
        <details className="group mt-1.5">
          <summary className="cursor-pointer list-none text-sm leading-relaxed text-muted-foreground line-clamp-3 group-open:line-clamp-none [&::-webkit-details-marker]:hidden">
            {tool.description}
          </summary>
        </details>
      )}

      {props && props.length > 0 ? (
        <dl className="mt-3 space-y-1.5 border-t border-border pt-3">
          {props.map((p) => (
            <div key={p.name} className="flex flex-wrap items-baseline gap-x-2 text-xs">
              <dt className="font-mono text-foreground">{p.name}</dt>
              {p.type && <span className="font-mono text-muted-foreground">{p.type}</span>}
              {p.required && <span className="text-deny">required</span>}
              {p.description && <dd className="w-full text-muted-foreground">{p.description}</dd>}
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">No parameters.</p>
      )}
    </article>
  );
}
