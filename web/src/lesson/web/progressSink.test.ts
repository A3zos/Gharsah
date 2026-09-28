import { withRetry } from './progressSink';

const noSleep = () => Promise.resolve();

test('withRetry: a save that fails then succeeds is retried with backoff', async () => {
  const waits: number[] = [];
  let calls = 0;
  const v = await withRetry(
    'progress save',
    async () => {
      calls++;
      if (calls < 3) throw Object.assign(new Error('fetch failed'), { code: '' });
      return 'ok';
    },
    [500, 1500, 4000],
    async (ms) => {
      waits.push(ms);
    },
  );
  expect(v).toBe('ok');
  expect(calls).toBe(3);
  expect(waits).toEqual([500, 1500]);
});

test('withRetry: after the last try the Supabase error code is logged and the error re-thrown', async () => {
  const errors: unknown[][] = [];
  const spy = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => void errors.push(a));
  let calls = 0;
  const boom = Object.assign(new Error('insert or update on table "progress" violates foreign key'), {
    code: '23503',
  });
  await expect(
    withRetry(
      'progress save',
      async () => {
        calls++;
        throw boom;
      },
      [1, 1, 1],
      noSleep,
    ),
  ).rejects.toBe(boom);
  expect(calls).toBe(4);
  expect(errors).toHaveLength(1);
  expect(errors[0]!.join(' ')).toContain('23503');
  spy.mockRestore();
});
