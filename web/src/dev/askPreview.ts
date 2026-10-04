// DEV-ONLY «اسألني» preview: /child/ask?preview=1&askPreview=answer (or sensitive / offTopic /
// notReady / thinking / listening) opens the screen on that state. The answer is LOREM IPSUM —
// a placeholder for the future answer card's layout, never religious content. Production builds
// drop it (import.meta.env.DEV); remove together with the child preview before release.
import type { AskAnswer } from '../ask/AskService';
import { initialAskState, type AskState } from '../ask/askState';

const LOREM: AskAnswer = {
  kind: 'answer',
  text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
  sources: [
    { label: 'QuranEnc', url: 'https://quranenc.com' },
    { label: 'HadeethEnc', url: 'https://hadeethenc.com' },
    { label: 'Lorem ipsum (book)' },
  ],
};

const QUESTION = { kind: 'text' as const, text: 'Lorem ipsum dolor sit amet?' };

export function askPreviewState(search: string): AskState | null {
  if (!import.meta.env.DEV) return null;
  const which = new URLSearchParams(search).get('askPreview');
  switch (which) {
    case 'answer':
      return { phase: 'answer', question: QUESTION, answer: LOREM, note: null };
    case 'sensitive':
    case 'offTopic':
      return { phase: which, question: QUESTION, answer: { ...LOREM, kind: which, sources: [] }, note: null };
    case 'notReady':
    case 'thinking':
      return { phase: which, question: QUESTION, answer: null, note: null };
    case 'listening':
      return { ...initialAskState, phase: 'listening' };
    default:
      return null;
  }
}
