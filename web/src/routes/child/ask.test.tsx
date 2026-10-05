// «اسألني» on the AI server's «اسأل وجاوب» mode — the screen with a fake service, mic and voice:
// chip / typed / spoken → thinking → the teacher says the answer (the bubble shows it exactly) →
// the chips come back; goodbye → home; failures → the notReady line; ar / en / id.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';

import type { AskTeacherVoice } from '../../ask/askRuntime';
import type { AskResult, AskService } from '../../ask/AskService';
import type { AskListenResult, AskVoice } from '../../ask/askVoice';
import { askPreviewState } from '../../dev/askPreview';
import { STORAGE_KEY } from '../../i18n/i18n';
import { I18nProvider } from '../../i18n/I18nProvider';
import { ASK_SLOW_MS, AskScreen } from './ask';

/** A service the test answers by hand (the «thinking» moment stays until it does). */
function manualService() {
  const asked: string[] = [];
  let reply: (r: AskResult) => void = () => {};
  let fail: (e: Error) => void = () => {};
  const warm = vi.fn();
  const service: AskService = {
    warm,
    ask: (q) => {
      asked.push(q);
      return new Promise((res, rej) => {
        reply = res;
        fail = rej;
      });
    },
  };
  return {
    service,
    asked,
    warm,
    answer: (r: AskResult) => act(() => reply(r)),
    fail: () => act(() => fail(new Error('500 Internal Server Error'))),
  };
}

function manualVoice() {
  let done: (r: AskListenResult) => void = () => {};
  const voice: AskVoice = { listen: () => new Promise((r) => (done = r)), close: vi.fn() };
  return { voice, hear: (r: AskListenResult) => act(() => done(r)) };
}

function fakeTeacher() {
  const said: string[] = [];
  let finish: () => void = () => {};
  const teacher: AskTeacherVoice = {
    speak: (text) => {
      said.push(text);
      return new Promise<void>((r) => (finish = r));
    },
    stop: vi.fn(),
  };
  return { teacher, said, done: () => act(() => finish()) };
}

function renderAsk(props: Partial<React.ComponentProps<typeof AskScreen>> = {}, lang?: 'ar' | 'en' | 'id') {
  if (lang) localStorage.setItem(STORAGE_KEY, lang);
  const Stub = createRoutesStub([
    {
      path: '/child/ask',
      Component: () => (
        <I18nProvider>
          <AskScreen gender="boy" {...props} />
        </I18nProvider>
      ),
    },
    { path: '/child/home', Component: () => <p>HOME</p> },
  ]);
  return render(<Stub initialEntries={['/child/ask']} />);
}

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
  document.documentElement.lang = 'ar';
  document.documentElement.dir = 'rtl';
});

const ANSWER = 'نصلي لأن الله أمرنا بالصلاة، وهي صلة بيننا وبين ربنا يا بطل.';

test('Arabic: a chip → thinking → the teacher SAYS the answer — nothing she says is written; the chips come back', async () => {
  const s = manualService();
  const v = fakeTeacher();
  renderAsk({ service: s.service, teacher: v.teacher, voice: manualVoice().voice });
  // 2026-10-05: with a voice the teacher only speaks — her greeting and answer are never written
  await screen.findByRole('button', { name: 'لماذا نصلّي؟' });
  expect(v.said).toEqual(['اسألني أي سؤال عن دينك يا بطل!']);
  expect(screen.queryByText('اسألني أي سؤال عن دينك يا بطل!')).toBeNull();
  expect(s.warm).toHaveBeenCalledTimes(1); // the session starts when the screen opens
  fireEvent.click(screen.getByRole('button', { name: 'لماذا نصلّي؟' }));
  expect(screen.queryByRole('status')).toBeNull();
  expect(s.asked).toEqual(['لماذا نصلّي؟']);
  await s.answer({ kind: 'answer', text: ANSWER, sources: [] });
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.queryByText(ANSWER)).toBeNull();
  expect(v.said).toEqual(['اسألني أي سؤال عن دينك يا بطل!', ANSWER]);
  // ready for the next question: the chips, the mic and the keyboard are back
  expect(screen.getAllByRole('tab')).toHaveLength(4);
  expect(screen.getByRole('button', { name: 'اضغط وتكلّم' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'لماذا نصوم؟' }));
  expect(s.asked).toEqual(['لماذا نصلّي؟', 'لماذا نصوم؟']);
});

test('English: the mic → speech recognition → the child’s words go to the service', async () => {
  const s = manualService();
  const mic = manualVoice();
  renderAsk({ service: s.service, voice: mic.voice }, 'en');
  fireEvent.click(await screen.findByRole('button', { name: 'Tap and talk' }));
  expect(screen.getByRole('status')).toHaveTextContent("I'm listening…");
  await mic.hear({ text: 'Why do we fast?' });
  expect(screen.getByRole('status')).toHaveTextContent('Let me think…');
  expect(s.asked).toEqual(['Why do we fast?']);
  await s.answer({ kind: 'answer', text: 'We fast because Allah asked us to, champ.', sources: [] });
  expect(screen.getByRole('status')).toHaveTextContent('We fast because Allah asked us to, champ.');
  expect(document.documentElement).toHaveAttribute('dir', 'ltr');
});

test('Indonesian: no speech recognition in this browser → keyboard + chips only (no broken mic)', async () => {
  const s = manualService();
  renderAsk({ service: s.service, voice: null }, 'id');
  expect(await screen.findByLabelText('Pertanyaanmu')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Ketuk dan bicara' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Ketik pertanyaanmu' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Pertanyaanmu'), { target: { value: 'Kenapa kita shalat?' } });
  fireEvent.click(screen.getByRole('button', { name: 'Kirim' }));
  expect(s.asked).toEqual(['Kenapa kita shalat?']);
});

test('expects none: the teacher says goodbye, then the child home after 2 s', async () => {
  const s = manualService();
  const v = fakeTeacher();
  renderAsk({ service: s.service, teacher: v.teacher, voice: null });
  fireEvent.change(await screen.findByLabelText('سؤالك'), { target: { value: 'مع السلامة' } });
  fireEvent.click(screen.getByRole('button', { name: 'أرسل' }));
  await s.answer({ kind: 'goodbye', text: 'مع السلامة يا بطل، في أمان الله!' });
  expect(v.said).toContain('مع السلامة يا بطل، في أمان الله!'); // said, not written
  expect(screen.queryByLabelText('سؤالك')).toBeNull(); // nothing more to ask
  vi.useFakeTimers();
  await v.done();
  expect(screen.queryByText('HOME')).toBeNull();
  await act(() => vi.advanceTimersByTime(2000));
  expect(screen.getByText('HOME')).toBeInTheDocument();
});

test('a failure → the friendly notReady line (never technical text)', async () => {
  const s = manualService();
  renderAsk({ service: s.service, voice: null });
  fireEvent.change(await screen.findByLabelText('سؤالك'), { target: { value: 'سؤال' } });
  fireEvent.click(screen.getByRole('button', { name: 'أرسل' }));
  await s.fail();
  expect(screen.getByRole('status')).toHaveTextContent('سؤالك جميل! قريبًا أجاوبك عليه من مصادر موثوقة 🌱');
  expect(document.body.textContent).not.toMatch(/500|Error/);
});

test('a long wait (cold start) → «لحظة أجهّز لك الجواب…»', async () => {
  const s = manualService();
  renderAsk({ service: s.service, voice: null });
  const field = await screen.findByLabelText('سؤالك');
  vi.useFakeTimers();
  fireEvent.change(field, { target: { value: 'من خلق النجوم؟' } });
  fireEvent.click(screen.getByRole('button', { name: 'أرسل' }));
  expect(screen.getByRole('status')).toHaveTextContent('لحظة أفكّر…');
  await act(() => vi.advanceTimersByTime(ASK_SLOW_MS + 10));
  expect(screen.getByRole('status')).toHaveTextContent('لحظة أجهّز لك الجواب…');
});

test('the mic heard nothing / is blocked → back to the suggestions with a gentle line', async () => {
  const mic = manualVoice();
  renderAsk({ voice: mic.voice });
  fireEvent.click(await screen.findByRole('button', { name: 'اضغط وتكلّم' }));
  await mic.hear('silent');
  expect(screen.getByRole('status')).toHaveTextContent('ما سمعتك… جرّب مرة ثانية أو اكتب سؤالك');
  fireEvent.click(screen.getByRole('button', { name: 'اضغط وتكلّم' }));
  await mic.hear('denied');
  expect(screen.getByRole('status')).toHaveTextContent('المايك مقفول — اكتب سؤالك');
  expect(screen.getAllByRole('tab')).toHaveLength(4);
});

test('not connected (no AI server configured) → «قريبًا…» with the question shown back', async () => {
  const s = manualService();
  renderAsk({ service: s.service, voice: null });
  fireEvent.click(await screen.findByRole('tab', { name: 'قصص الأنبياء' }));
  fireEvent.click(screen.getByRole('button', { name: 'من بنى الكعبة؟' }));
  await s.answer({ kind: 'notReady' });
  expect(screen.getByRole('status')).toHaveTextContent('سؤالك جميل! قريبًا أجاوبك عليه من مصادر موثوقة 🌱');
  expect(screen.getByText('من بنى الكعبة؟')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'اسأل سؤالًا آخر' }));
  expect(screen.getByText('اسألني أي سؤال عن دينك يا بطل!')).toBeInTheDocument();
});

test('?askPreview=answer (dev only): the future answer card with sources — lorem only', async () => {
  const initial = askPreviewState('?preview=1&askPreview=answer')!;
  expect(initial.answer!.text).toMatch(/^Lorem ipsum/);
  renderAsk({ initial });
  expect(await screen.findByText('المصدر')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'QuranEnc' })).toHaveAttribute('href', 'https://quranenc.com');
  expect(screen.getByText('اسأل وليّ أمرك أيضًا')).toBeInTheDocument();
});
