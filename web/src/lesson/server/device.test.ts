import { describe, expect, it } from 'vitest';

import { agentDeviceId } from './device';

class MemStore {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('agentDeviceId', () => {
  it('a random UUID per child profile, stable across calls', async () => {
    const store = new MemStore();
    const a1 = await agentDeviceId('child-a', store);
    const a2 = await agentDeviceId('child-a', store);
    const b = await agentDeviceId('child-b', store);
    expect(a1).toMatch(UUID);
    expect(a2).toBe(a1);
    expect(b).not.toBe(a1);
  });

  it('never stores or returns our own ids', async () => {
    const store = new MemStore();
    const childId = '10000000-0000-0000-0000-0000000000a1';
    const id = await agentDeviceId(childId, store);
    expect(id).not.toBe(childId);
    expect([...store.data.values()].join()).not.toContain(childId);
  });

  it('works without storage (a fresh id) and with corrupt storage', async () => {
    expect(await agentDeviceId('x', null)).toMatch(UUID);
    const store = new MemStore();
    store.setItem('gharsah.ai.devices', '{not json');
    expect(await agentDeviceId('x', store)).toMatch(UUID);
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(await agentDeviceId('x', throwing)).toMatch(UUID);
  });
});
