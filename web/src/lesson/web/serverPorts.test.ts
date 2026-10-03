import { describe, expect, it } from 'vitest';

import { pickBrowserVoice, speechChunks } from './serverPorts';

describe('speechChunks (/speak cuts at 1200 characters)', () => {
  it('short lines stay whole; empty → nothing', () => {
    expect(speechChunks('أهلًا يا بطل')).toEqual(['أهلًا يا بطل']);
    expect(speechChunks('   ')).toEqual([]);
  });

  it('long lines split at sentence ends, every piece within the limit, nothing lost', () => {
    const sentence = 'هذه جملة طويلة للمعلّم يشرح فيها معنى الآية للطفل. ';
    const text = sentence.repeat(60).trim();
    const pieces = speechChunks(text, 300);
    expect(pieces.length).toBeGreaterThan(1);
    for (const p of pieces) expect(p.length).toBeLessThanOrEqual(300);
    expect(pieces.join(' ').replace(/\s+/g, ' ')).toBe(text.replace(/\s+/g, ' '));
  });

  it('a single huge sentence is hard-cut', () => {
    const pieces = speechChunks('ا'.repeat(2500), 1000);
    expect(pieces.map((p) => p.length)).toEqual([1000, 1000, 500]);
  });
});

describe('pickBrowserVoice', () => {
  const v = (lang: string, name = lang) => ({ lang, name }) as SpeechSynthesisVoice;
  const voices = [v('en-GB'), v('ar-EG'), v('ar-SA'), v('en-US'), v('id_ID')];

  it('the session language, its main locale first', () => {
    expect(pickBrowserVoice(voices, 'ar')?.lang).toBe('ar-SA');
    expect(pickBrowserVoice(voices, 'en')?.lang).toBe('en-US');
    expect(pickBrowserVoice(voices, 'id')?.lang).toBe('id_ID');
  });

  it('none for that language → null (the line shows as text, never another language)', () => {
    expect(pickBrowserVoice([v('fr-FR')], 'en')).toBeNull();
  });
});
