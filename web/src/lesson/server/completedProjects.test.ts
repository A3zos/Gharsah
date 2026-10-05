// The projects the teacher verified at the start of a later hadith lesson (2026-10-04):
// read from the AI server's /agent/actions (status «done»); never throws, never a self-ticked box.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadVerifiedProjects, resetCompletedProjectsCache, verifiedProjects } from './completedProjects';
import type { ActionItem } from './parse';

const item = (hadithId: number, status?: ActionItem['status'], done = false): ActionItem => ({
  hadithId,
  title: `h${hadithId}`,
  action: `a${hadithId}`,
  done,
  ...(status ? { status } : {}),
});

describe('verifiedProjects', () => {
  it('keeps only the ones the next-lesson check marked done', () => {
    const all = [item(9, 'done', true), item(10, 'pending_next_lesson'), item(6, 'no_project'), item(1)];
    expect(verifiedProjects(all).map((i) => i.hadithId)).toEqual([9]);
  });

  it('a project ticked by hand (done, no status) is not a verified one', () => {
    expect(verifiedProjects([item(9, undefined, true)])).toEqual([]);
  });
});

describe('loadVerifiedProjects', () => {
  beforeEach(() => resetCompletedProjectsCache());

  it('reads /agent/actions once for the device and returns the verified ones', async () => {
    const actionItems = vi.fn(async () => [item(9, 'done', true), item(10, 'pending_next_lesson')]);
    const r = await loadVerifiedProjects('child-1', { actionItems }, async () => 'dev-1');
    expect(r.map((i) => i.hadithId)).toEqual([9]);
    expect(actionItems).toHaveBeenCalledWith('dev-1');
    // the home and the projects screen share the read
    await loadVerifiedProjects('child-1', { actionItems }, async () => 'dev-1');
    expect(actionItems).toHaveBeenCalledTimes(1);
  });

  it('any failure → none (the screens show what Supabase knows)', async () => {
    const actionItems = vi.fn(async () => {
      throw new Error('offline');
    });
    await expect(loadVerifiedProjects('child-2', { actionItems }, async () => 'dev-2')).resolves.toEqual([]);
  });

  it('no AI server configured → none, no request', async () => {
    await expect(loadVerifiedProjects('child-3', null, async () => 'dev-3')).resolves.toEqual([]);
  });
});
