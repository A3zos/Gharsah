import { describe, expect, it } from 'vitest';

import { MESSAGES } from '../i18n/i18n';
import { ASK_CATEGORIES, askQuestionLabel } from '../content/askSuggestions';
import { askEnabled, NotConnectedAskService, type AskAnswer } from './AskService';
import { askReducer, initialAskState, MAX_QUESTION_LENGTH, type AskEvent, type AskState } from './askState';

const run = (events: AskEvent[], from: AskState = initialAskState) => events.reduce(askReducer, from);
const ANSWER: AskAnswer = { kind: 'answer', text: 'x', sources: [] };

describe('askState', () => {
  it('a suggestion / typed question → thinking → notReady (not connected), the question kept', () => {
    const thinking = run([{ type: 'ask', text: '  Why?  ' }]);
    expect(thinking).toMatchObject({ phase: 'thinking', question: { kind: 'text', text: 'Why?' } });
    const done = askReducer(thinking, { type: 'result', result: { kind: 'notReady' } });
    expect(done).toMatchObject({ phase: 'notReady', question: { kind: 'text', text: 'Why?' }, answer: null });
    expect(askReducer(done, { type: 'again' })).toEqual(initialAskState);
  });

  it('the mic: listening → heard → thinking with a voice question', () => {
    const listening = run([{ type: 'micTap' }]);
    expect(listening.phase).toBe('listening');
    expect(run([{ type: 'heard' }], listening)).toMatchObject({
      phase: 'thinking',
      question: { kind: 'voice' },
    });
    // a second tap = «I'm done»
    expect(run([{ type: 'micTap' }], listening)).toMatchObject({
      phase: 'thinking',
      question: { kind: 'voice' },
    });
  });

  it('the mic heard nothing / is blocked / was cancelled → idle (+ a note)', () => {
    const listening = run([{ type: 'micTap' }]);
    expect(run([{ type: 'notHeard' }], listening)).toEqual({ ...initialAskState, note: 'notHeard' });
    expect(run([{ type: 'micBlocked' }], listening)).toEqual({ ...initialAskState, note: 'micBlocked' });
    expect(run([{ type: 'cancel' }], listening)).toEqual(initialAskState);
    // the note goes away with the next question
    expect(run([{ type: 'notHeard' }, { type: 'micTap' }], listening).note).toBeNull();
  });

  it('results by kind: answer / sensitive / offTopic; a failure → notReady', () => {
    const thinking = run([{ type: 'ask', text: 'q' }]);
    expect(askReducer(thinking, { type: 'result', result: ANSWER })).toMatchObject({
      phase: 'answer',
      answer: ANSWER,
    });
    expect(askReducer(thinking, { type: 'result', result: { ...ANSWER, kind: 'sensitive' } }).phase).toBe(
      'sensitive',
    );
    expect(askReducer(thinking, { type: 'result', result: { ...ANSWER, kind: 'offTopic' } }).phase).toBe(
      'offTopic',
    );
    expect(askReducer(thinking, { type: 'failed' }).phase).toBe('notReady');
  });

  it('ignores what makes no sense in a state', () => {
    const thinking = run([{ type: 'ask', text: 'q' }]);
    for (const e of [
      { type: 'ask', text: 'other' },
      { type: 'micTap' },
      { type: 'again' },
      { type: 'heard' },
    ] as AskEvent[])
      expect(askReducer(thinking, e)).toBe(thinking);
    expect(askReducer(initialAskState, { type: 'result', result: { kind: 'notReady' } })).toBe(
      initialAskState,
    );
    expect(askReducer(initialAskState, { type: 'ask', text: '   ' })).toBe(initialAskState);
  });

  it('asking again straight from a result; long questions are cut', () => {
    const done = run([
      { type: 'ask', text: 'q' },
      { type: 'result', result: { kind: 'notReady' } },
    ]);
    expect(run([{ type: 'ask', text: 'next' }], done)).toMatchObject({
      phase: 'thinking',
      question: { text: 'next' },
    });
    expect(run([{ type: 'micTap' }], done).phase).toBe('listening');
    const long = run([{ type: 'ask', text: 'x'.repeat(500) }]);
    expect(long.question).toEqual({ kind: 'text', text: 'x'.repeat(MAX_QUESTION_LENGTH) });
  });
});

describe('AskService (not connected)', () => {
  it('always «not ready» — after the thinking moment', async () => {
    const waits: number[] = [];
    const s = new NotConnectedAskService(1200, async (ms) => void waits.push(ms));
    await expect(s.ask()).resolves.toEqual({ kind: 'notReady' });
    expect(waits).toEqual([1200]);
  });

  it('VITE_ASK_ENABLED: on unless 0 / false / off', () => {
    expect(askEnabled({})).toBe(true);
    expect(askEnabled({ VITE_ASK_ENABLED: '1' })).toBe(true);
    for (const v of ['0', 'false', 'OFF']) expect(askEnabled({ VITE_ASK_ENABLED: v })).toBe(false);
  });
});

describe('suggested questions', () => {
  it('four categories; every question labelled in ar / en / id — questions only (they end with ?)', () => {
    expect(ASK_CATEGORIES.map((c) => c.id)).toEqual(['why', 'prophets', 'universe', 'manners']);
    for (const lang of ['ar', 'en', 'id'] as const) {
      for (const c of ASK_CATEGORIES) {
        expect((MESSAGES[lang].child.ask.categories as Record<string, string>)[c.id]).toBeTruthy();
        for (const q of c.questions) expect(askQuestionLabel(lang, c.id, q)).toMatch(/[?؟]$/);
      }
    }
  });
});
