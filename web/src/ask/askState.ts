// «اسألني» — the screen's state machine (pure: the route only renders it and dispatches).
//
//   idle ──micTap──▶ listening ──heard / micTap──▶ thinking ──result──▶ notReady | answer | sensitive | offTopic
//    │                   └─notHeard / micBlocked / cancel─▶ idle (+ a note)          │
//    └──────────ask(text)────────────────────────────────▶ thinking ◀──ask(text)────┘
//   any result ──again──▶ idle
import type { AskAnswer, AskResult } from './AskService';

export type AskPhase = 'idle' | 'listening' | 'thinking' | 'answer' | 'notReady' | 'sensitive' | 'offTopic';

/** Typed (or a suggestion), or said out loud (not transcribed: nothing is sent anywhere yet). */
export type AskQuestion = { kind: 'text'; text: string } | { kind: 'voice' };

/** A gentle line on idle after the mic couldn't help. */
export type AskNote = 'notHeard' | 'micBlocked' | null;

export interface AskState {
  readonly phase: AskPhase;
  readonly question: AskQuestion | null;
  readonly answer: AskAnswer | null;
  readonly note: AskNote;
}

export type AskEvent =
  | { type: 'micTap' }
  | { type: 'heard' }
  | { type: 'notHeard' }
  | { type: 'micBlocked' }
  | { type: 'cancel' }
  | { type: 'ask'; text: string }
  | { type: 'result'; result: AskResult }
  | { type: 'failed' }
  | { type: 'again' };

export const initialAskState: AskState = { phase: 'idle', question: null, answer: null, note: null };

/** Asking is possible from idle and from any finished result. */
const CAN_ASK: ReadonlySet<AskPhase> = new Set(['idle', 'answer', 'notReady', 'sensitive', 'offTopic']);

/** The longest question a child may type. */
export const MAX_QUESTION_LENGTH = 300;

export function askReducer(s: AskState, e: AskEvent): AskState {
  switch (e.type) {
    case 'micTap':
      if (CAN_ASK.has(s.phase)) return { phase: 'listening', question: null, answer: null, note: null };
      // a second tap while listening = «I'm done»
      if (s.phase === 'listening') return { ...s, phase: 'thinking', question: { kind: 'voice' } };
      return s;
    case 'heard':
      return s.phase === 'listening' ? { ...s, phase: 'thinking', question: { kind: 'voice' } } : s;
    case 'notHeard':
    case 'micBlocked':
      return s.phase === 'listening' ? { ...initialAskState, note: e.type } : s;
    case 'cancel':
      return s.phase === 'listening' ? initialAskState : s;
    case 'ask': {
      const text = e.text.trim().slice(0, MAX_QUESTION_LENGTH);
      if (!text || !CAN_ASK.has(s.phase)) return s;
      return { phase: 'thinking', question: { kind: 'text', text }, answer: null, note: null };
    }
    case 'result':
      if (s.phase !== 'thinking') return s;
      if (e.result.kind === 'notReady') return { ...s, phase: 'notReady', answer: null };
      return { ...s, phase: e.result.kind, answer: e.result };
    case 'failed':
      return s.phase === 'thinking' ? { ...s, phase: 'notReady', answer: null } : s;
    case 'again':
      return s.phase === 'thinking' ? s : initialAskState;
  }
}
