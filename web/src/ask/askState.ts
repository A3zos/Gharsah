// «اسألني» — the screen's state machine (pure: the route only renders it and dispatches).
//
//   idle ──micTap──▶ listening ──heard(text)──▶ thinking ──result──▶ answer | goodbye | notReady | sensitive | offTopic
//    │                   └─notHeard / micBlocked / cancel / micTap─▶ idle (+ a note)     │
//    └──────────ask(text)──────────────────────────▶ thinking ◀──ask(text) / micTap──────┘
//   any result (not goodbye) ──again──▶ idle; goodbye = the session is over (the screen goes home)
import type { AskAnswer, AskResult } from './AskService';

export type AskPhase =
  'idle' | 'listening' | 'thinking' | 'answer' | 'goodbye' | 'notReady' | 'sensitive' | 'offTopic';

/** Typed, a suggestion or transcribed speech — or said out loud with nothing transcribed. */
export type AskQuestion = { kind: 'text'; text: string } | { kind: 'voice' };

/** A gentle line on idle after the mic couldn't help. */
export type AskNote = 'notHeard' | 'micBlocked' | null;

export interface AskState {
  readonly phase: AskPhase;
  readonly question: AskQuestion | null;
  /** The answer / the goodbye — its text is the server's `say`, exactly as received. */
  readonly answer: AskAnswer | { kind: 'goodbye'; text: string } | null;
  readonly note: AskNote;
}

export type AskEvent =
  | { type: 'micTap' }
  | { type: 'heard'; text?: string }
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
      // a second tap while listening = stop (the mic closes, nothing asked)
      if (s.phase === 'listening') return initialAskState;
      return s;
    case 'heard': {
      if (s.phase !== 'listening') return s;
      const text = e.text?.trim().slice(0, MAX_QUESTION_LENGTH);
      return { ...s, phase: 'thinking', question: text ? { kind: 'text', text } : { kind: 'voice' } };
    }
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
      return s.phase === 'thinking' || s.phase === 'goodbye' ? s : initialAskState;
  }
}
