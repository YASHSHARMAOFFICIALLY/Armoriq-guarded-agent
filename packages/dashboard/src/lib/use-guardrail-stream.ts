'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_BASE } from './api';
import {
  SERVER_EVENT_NAMES,
  type Attestation,
  type Decision,
  type ServerEvent,
  type ToolCallProposal,
  type ToolResult,
} from './types';

// One row in the console. A `proposal` row fills in over time: first the proposal,
// then its decision, then (if it ran) its result — all correlated by proposalId.
export type TimelineItem =
  | { kind: 'user'; key: string; text: string }
  | {
      kind: 'proposal';
      key: string;
      proposalId: string;
      proposal: ToolCallProposal;
      decision?: Decision;
      result?: ToolResult;
      approvalId?: string;
      attestation?: Attestation;
    }
  | { kind: 'assistant'; key: string; text: string }
  | { kind: 'error'; key: string; message: string };

export interface StreamState {
  items: TimelineItem[];
  running: boolean;
  seq: number; // monotonic key source (no Date.now/random → stable across renders)
}

export const initialStreamState: StreamState = { items: [], running: false, seq: 0 };

type Action =
  | { t: 'user'; text: string }
  | { t: 'event'; e: ServerEvent }
  | { t: 'reset' };

// Exported (and pure) so the event-correlation logic can be unit-tested without React.
export function guardrailReducer(state: StreamState, action: Action): StreamState {
  switch (action.t) {
    case 'reset':
      return { items: [], running: false, seq: 0 };

    case 'user':
      return {
        ...state,
        running: true,
        seq: state.seq + 1,
        items: [...state.items, { kind: 'user', key: `u${state.seq}`, text: action.text }],
      };

    case 'event': {
      const e = action.e;
      switch (e.type) {
        case 'turn:start':
          return { ...state, running: true };
        case 'turn:end':
          return { ...state, running: false };

        case 'proposal':
          // ignore duplicates (a race with approval:required can re-deliver it)
          if (state.items.some((i) => i.kind === 'proposal' && i.proposalId === e.proposal.id)) return state;
          return {
            ...state,
            items: [
              ...state.items,
              { kind: 'proposal', key: `p${e.proposal.id}`, proposalId: e.proposal.id, proposal: e.proposal },
            ],
          };

        case 'decision':
          return {
            ...state,
            items: state.items.map((i) =>
              i.kind === 'proposal' && i.proposalId === e.proposalId
                ? {
                    ...i,
                    decision: e.decision,
                    approvalId: e.decision.requiresApprovalId ?? i.approvalId,
                    attestation: e.attestation ?? i.attestation,
                  }
                : i,
            ),
          };

        case 'approval:required': {
          const exists = state.items.some((i) => i.kind === 'proposal' && i.proposalId === e.proposal.id);
          if (exists) {
            return {
              ...state,
              items: state.items.map((i) =>
                i.kind === 'proposal' && i.proposalId === e.proposal.id ? { ...i, approvalId: e.approvalId } : i,
              ),
            };
          }
          return {
            ...state,
            items: [
              ...state.items,
              {
                kind: 'proposal',
                key: `p${e.proposal.id}`,
                proposalId: e.proposal.id,
                proposal: e.proposal,
                approvalId: e.approvalId,
              },
            ],
          };
        }

        case 'execution':
          // result arriving means the gate (if any) is resolved — clear approvalId
          return {
            ...state,
            items: state.items.map((i) =>
              i.kind === 'proposal' && i.proposalId === e.proposalId
                ? { ...i, result: e.result, approvalId: undefined }
                : i,
            ),
          };

        case 'assistant:text':
          return {
            ...state,
            seq: state.seq + 1,
            items: [...state.items, { kind: 'assistant', key: `a${state.seq}`, text: e.content }],
          };

        case 'error':
          return {
            ...state,
            running: false,
            seq: state.seq + 1,
            items: [...state.items, { kind: 'error', key: `e${state.seq}`, message: e.message }],
          };

        default:
          return state;
      }
    }
  }
}

export interface GuardrailStream {
  connected: boolean;
  running: boolean;
  items: TimelineItem[];
  /** pending human-approval gates (proposal rows with an approvalId and no result yet) */
  pending: Extract<TimelineItem, { kind: 'proposal' }>[];
  pushUser: (text: string) => void;
  reset: () => void;
}

// Subscribe to one conversation's live guardrail stream. The socket subscription is
// the legitimate effect here; everything else is derived from reducer state.
export function useGuardrailStream(conversationId: string): GuardrailStream {
  const [state, dispatch] = useReducer(guardrailReducer, initialStreamState);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(API_BASE, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join', conversationId);
    });
    socket.on('disconnect', () => setConnected(false));

    for (const name of SERVER_EVENT_NAMES) {
      socket.on(name, (payload: ServerEvent) => dispatch({ t: 'event', e: payload }));
    }

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [conversationId]);

  const pending = state.items.filter(
    (i): i is Extract<TimelineItem, { kind: 'proposal' }> =>
      i.kind === 'proposal' && Boolean(i.approvalId) && !i.result,
  );

  return {
    connected,
    running: state.running,
    items: state.items,
    pending,
    pushUser: (text: string) => dispatch({ t: 'user', text }),
    reset: () => dispatch({ t: 'reset' }),
  };
}
