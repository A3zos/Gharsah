// «اسألني» — UI only: chip / typed / mic → thinking → «not ready yet», in ar / en / id; the
// future answer card in the dev preview. Nothing is sent: the service and the mic are fakes here.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';

import type { AskResult, AskService } from '../../ask/AskService';
import type { AskListenResult, AskVoice } from '../../ask/askVoice';
import { askPreviewState } from '../../dev/askPreview';
import { STORAGE_KEY } from '../../i18n/i18n';
import { I18nProvider } from '../../i18n/I18nProvider';
import { AskScreen } from './ask';

/** A service the test answers by hand (the «thinking» moment stays until it does). */
function manualService() {
  const asked: string[] = [];
  let reply: (r: AskResult) => void = () => {};
  const service: AskService = {
    ask: (q) => {
      asked.push(q);
      return new Promise((r) => (reply = r));
    },
  };
  return { service, asked, answer: (r: AskResult) => act(() => reply(r)) };
}

function manualVoice() {
  let done: (r: AskListenResult) => void = () => {};
  const close = vi.fn();
  const voice: AskVoice = { listen: () => new Promise((r) => (done = r)), close };
  return { voice, close, hear: (r: AskListenResult) => act(() => done(r)) };
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
  localStorage.clear();
  document.documentElement.lang = 'ar';
  document.documentElement.dir = 'rtl';
});

test('Arabic: the greeting and the suggestions → a chip → thinking → «قريبًا أجاوبك» with the question shown back', async () => {
  const s = manualService();
  renderAsk({ service: s.service });
  expect(await screen.findByText('اسألني أي سؤال عن دينك يا بطل!')).toBeInTheDocument();
  expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
    'لماذا؟',
    'قصص الأنبياء',
    'الله والكون',
    'أخلاقي',
  ]);
  fireEvent.click(screen.getByRole('tab', { name: 'قصص الأنبياء' }));
  fireEvent.click(screen.getByRole('button', { name: 'من بنى الكعبة؟' }));
  expect(screen.getByRole('status')).toHaveTextContent('لحظة أفكّر…');
  expect(s.asked).toEqual(['من بنى الكعبة؟']);
  await s.answer({ kind: 'notReady' });
  expect(screen.getByRole('status')).toHaveTextContent('سؤالك جميل! قريبًا أجاوبك عليه من مصادر موثوقة 🌱');
  expect(screen.getByText('من بنى الكعبة؟')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'اسأل سؤالًا آخر' }));
  expect(screen.getByText('اسألني أي سؤال عن دينك يا بطل!')).toBeInTheDocument();
  expect(document.documentElement).toHaveAttribute('dir', 'rtl');
});

test('English: the mic → listening → the child stops talking → thinking → not ready (asked out loud)', async () => {
  const s = manualService();
  const v = manualVoice();
  renderAsk({ service: s.service, voice: v.voice }, 'en');
  fireEvent.click(await screen.findByRole('button', { name: 'Tap and talk' }));
  expect(screen.getByRole('status')).toHaveTextContent("I'm listening…");
  expect(screen.getByText('Your question shows here')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: "I'm done asking" })).toHaveAttribute('aria-pressed', 'true');
  await v.hear('spoke');
  expect(screen.getByRole('status')).toHaveTextContent('Let me think…');
  await s.answer({ kind: 'notReady' });
  expect(screen.getByRole('status')).toHaveTextContent(
    "What a lovely question! Soon I'll answer it from trusted sources",
  );
  expect(screen.getByText('You asked me out loud')).toBeInTheDocument();
  expect(v.close).toHaveBeenCalled(); // the mic is released after listening
  expect(document.documentElement).toHaveAttribute('dir', 'ltr');
});

test('Indonesian: typing a question (older kids) → thinking → not ready', async () => {
  const s = manualService();
  renderAsk({ service: s.service }, 'id');
  fireEvent.click(await screen.findByRole('button', { name: 'Ketik pertanyaanmu' }));
  fireEvent.change(screen.getByLabelText('Pertanyaanmu'), { target: { value: 'Mengapa langit biru?' } });
  fireEvent.click(screen.getByRole('button', { name: 'Kirim' }));
  expect(screen.getByRole('status')).toHaveTextContent('Sebentar, aku berpikir…');
  await s.answer({ kind: 'notReady' });
  expect(screen.getByText('Mengapa langit biru?')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Tanya pertanyaan lain' })).toBeInTheDocument();
});

test('the mic heard nothing / is blocked → back to the suggestions with a gentle line', async () => {
  const v = manualVoice();
  renderAsk({ voice: v.voice });
  fireEvent.click(await screen.findByRole('button', { name: 'اضغط وتكلّم' }));
  await v.hear('silent');
  expect(screen.getByRole('status')).toHaveTextContent('ما سمعتك… جرّب مرة ثانية أو اكتب سؤالك');
  fireEvent.click(screen.getByRole('button', { name: 'اضغط وتكلّم' }));
  await v.hear('denied');
  expect(screen.getByRole('status')).toHaveTextContent('المايك مقفول — اكتب سؤالك');
  expect(screen.getAllByRole('tab')).toHaveLength(4);
});

test('sensitive / off-topic: «اسأل وليّ أمرك» with the question', async () => {
  const s = manualService();
  renderAsk({ service: s.service });
  fireEvent.click(await screen.findByRole('button', { name: 'لماذا نصوم؟' }));
  await s.answer({ kind: 'sensitive', text: '', sources: [] });
  expect(screen.getByRole('status')).toHaveTextContent('هذا سؤال مهم، اسأل وليّ أمرك عنه');
  expect(screen.getByText('لماذا نصوم؟')).toBeInTheDocument();
});

test('?askPreview=answer (dev only): the future answer card — lorem text, source chips, the parent hint', async () => {
  const initial = askPreviewState('?preview=1&askPreview=answer')!;
  expect(initial.answer!.text).toMatch(/^Lorem ipsum/); // never real religious content
  renderAsk({ initial });
  expect(await screen.findByText(/^Lorem ipsum dolor sit amet, consectetur/)).toBeInTheDocument();
  expect(screen.getByText('المصدر')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'QuranEnc' })).toHaveAttribute('href', 'https://quranenc.com');
  expect(screen.getByRole('link', { name: 'HadeethEnc' })).toHaveAttribute('href', 'https://hadeethenc.com');
  expect(screen.getByText('اسأل وليّ أمرك أيضًا')).toBeInTheDocument();
  expect(askPreviewState('?askPreview=nope')).toBeNull();
});
