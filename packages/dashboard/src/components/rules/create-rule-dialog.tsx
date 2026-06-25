'use client';

import { Loader2, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { BudgetLimitConfig, InputValidationConfig, Rule, RuleType } from '@/lib/types';
import { RULE_META, RULE_TYPE_ORDER } from './rule-meta';

const inputCls =
  'h-9 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground';
const labelCls = 'mb-1.5 block text-xs font-medium text-muted-foreground';

export function CreateRuleDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  const [type, setType] = useState<RuleType>('BLOCK_TOOL');
  const [toolName, setToolName] = useState('');
  const [approverFallback, setApproverFallback] = useState<'AUTO_DENY' | 'AUTO_ALLOW'>('AUTO_DENY');
  const [timeoutSeconds, setTimeoutSeconds] = useState('60');
  const [field, setField] = useState('');
  const [pattern, setPattern] = useState('');
  const [allowedPrefix, setAllowedPrefix] = useState('');
  const [maxLength, setMaxLength] = useState('');
  const [scope, setScope] = useState<'CONVERSATION' | 'GLOBAL'>('CONVERSATION');
  const [maxTokens, setMaxTokens] = useState('');
  const [maxToolCalls, setMaxToolCalls] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open() {
    setError(null);
    dialogRef.current?.showModal();
  }
  function close() {
    dialogRef.current?.close();
  }
  function reset() {
    setType('BLOCK_TOOL');
    setToolName('');
    setApproverFallback('AUTO_DENY');
    setTimeoutSeconds('60');
    setField('');
    setPattern('');
    setAllowedPrefix('');
    setMaxLength('');
    setScope('CONVERSATION');
    setMaxTokens('');
    setMaxToolCalls('');
  }

  function buildRule(): Rule {
    const base = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      enabled: true,
      toolName: toolName.trim() || '*',
    };
    switch (type) {
      case 'BLOCK_TOOL':
        return { ...base, type, config: {} };
      case 'REQUIRE_APPROVAL': {
        const secs = Number(timeoutSeconds);
        if (!Number.isFinite(secs) || secs <= 0) throw new Error('Timeout must be a number greater than 0.');
        return { ...base, type, config: { approverFallback, timeoutSeconds: secs } };
      }
      case 'INPUT_VALIDATION': {
        if (!field.trim()) throw new Error('Field is required for input validation.');
        const config: InputValidationConfig = { field: field.trim() };
        if (pattern.trim()) {
          try {
            new RegExp(pattern.trim());
          } catch {
            throw new Error('Pattern is not a valid regular expression.');
          }
          config.pattern = pattern.trim();
        }
        if (allowedPrefix.trim()) config.allowedPrefix = allowedPrefix.trim();
        if (maxLength.trim()) config.maxLength = Number(maxLength);
        return { ...base, type, config };
      }
      case 'BUDGET_LIMIT': {
        if (!maxTokens.trim() && !maxToolCalls.trim())
          throw new Error('Set at least one of max tokens or max tool calls.');
        const config: BudgetLimitConfig = { scope };
        if (maxTokens.trim()) config.maxTokens = Number(maxTokens);
        if (maxToolCalls.trim()) config.maxToolCalls = Number(maxToolCalls);
        return { ...base, type, config };
      }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let rule: Rule;
    try {
      rule = buildRule();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid rule.');
      return;
    }
    setBusy(true);
    try {
      await api.createRule(rule);
      close();
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create the rule.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="primary" onClick={open}>
        <Plus className="h-4 w-4" aria-hidden />
        New rule
      </Button>

      <dialog
        ref={dialogRef}
        className="m-auto w-[min(34rem,92vw)] rounded-xl border border-border bg-card p-0 text-foreground shadow-xl"
        onClose={() => setBusy(false)}
      >
        <form onSubmit={submit} className="flex flex-col">
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold">New policy rule</h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </header>

          <div className="space-y-4 px-5 py-4">
            <div>
              <label htmlFor="rule-type" className={labelCls}>
                Rule type
              </label>
              <select
                id="rule-type"
                value={type}
                onChange={(e) => setType(e.target.value as RuleType)}
                className={inputCls}
              >
                {RULE_TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {RULE_META[t].label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-muted-foreground">{RULE_META[type].blurb}</p>
            </div>

            <div>
              <label htmlFor="rule-tool" className={labelCls}>
                Tool name
              </label>
              <input
                id="rule-tool"
                value={toolName}
                onChange={(e) => setToolName(e.target.value)}
                placeholder="e.g. block_ip   ( * for all tools )"
                autoComplete="off"
                className={`${inputCls} font-mono`}
              />
            </div>

            {type === 'REQUIRE_APPROVAL' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="rule-fallback" className={labelCls}>
                    Fallback if it times out
                  </label>
                  <select
                    id="rule-fallback"
                    value={approverFallback}
                    onChange={(e) => setApproverFallback(e.target.value as 'AUTO_DENY' | 'AUTO_ALLOW')}
                    className={inputCls}
                  >
                    <option value="AUTO_DENY">Auto-deny</option>
                    <option value="AUTO_ALLOW">Auto-allow</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="rule-timeout" className={labelCls}>
                    Timeout (seconds)
                  </label>
                  <input
                    id="rule-timeout"
                    type="number"
                    min={1}
                    value={timeoutSeconds}
                    onChange={(e) => setTimeoutSeconds(e.target.value)}
                    className={`${inputCls} font-mono`}
                  />
                </div>
              </div>
            )}

            {type === 'INPUT_VALIDATION' && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="rule-field" className={labelCls}>
                    Argument field to check
                  </label>
                  <input
                    id="rule-field"
                    value={field}
                    onChange={(e) => setField(e.target.value)}
                    placeholder="e.g. ip"
                    autoComplete="off"
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="rule-pattern" className={labelCls}>
                      Pattern (regex, optional)
                    </label>
                    <input
                      id="rule-pattern"
                      value={pattern}
                      onChange={(e) => setPattern(e.target.value)}
                      placeholder="^10\\."
                      autoComplete="off"
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                  <div>
                    <label htmlFor="rule-prefix" className={labelCls}>
                      Allowed prefix (optional)
                    </label>
                    <input
                      id="rule-prefix"
                      value={allowedPrefix}
                      onChange={(e) => setAllowedPrefix(e.target.value)}
                      autoComplete="off"
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="rule-maxlen" className={labelCls}>
                    Max length (optional)
                  </label>
                  <input
                    id="rule-maxlen"
                    type="number"
                    min={1}
                    value={maxLength}
                    onChange={(e) => setMaxLength(e.target.value)}
                    className={`${inputCls} font-mono`}
                  />
                </div>
              </div>
            )}

            {type === 'BUDGET_LIMIT' && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="rule-scope" className={labelCls}>
                    Scope
                  </label>
                  <select
                    id="rule-scope"
                    value={scope}
                    onChange={(e) => setScope(e.target.value as 'CONVERSATION' | 'GLOBAL')}
                    className={inputCls}
                  >
                    <option value="CONVERSATION">Per conversation</option>
                    <option value="GLOBAL">Global</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="rule-maxtokens" className={labelCls}>
                      Max tokens
                    </label>
                    <input
                      id="rule-maxtokens"
                      type="number"
                      min={1}
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(e.target.value)}
                      placeholder="optional"
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                  <div>
                    <label htmlFor="rule-maxcalls" className={labelCls}>
                      Max tool calls
                    </label>
                    <input
                      id="rule-maxcalls"
                      type="number"
                      min={1}
                      value={maxToolCalls}
                      onChange={(e) => setMaxToolCalls(e.target.value)}
                      placeholder="optional"
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                </div>
              </div>
            )}

            {error && <p className="text-xs text-deny">{error}</p>}
          </div>

          <footer className="flex items-center justify-between gap-2 border-t border-border px-5 py-4">
            <p className="text-xs text-muted-foreground">Rules apply immediately to new tool calls.</p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Create rule
              </Button>
            </div>
          </footer>
        </form>
      </dialog>
    </>
  );
}
