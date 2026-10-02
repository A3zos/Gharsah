import { describe, expect, it } from 'vitest';

import { speechChunks } from './serverPorts';

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
