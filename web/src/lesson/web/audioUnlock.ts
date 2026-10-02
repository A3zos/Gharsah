// Browsers only play sound after a tap. The lesson starts from a tap («ابدأ الحصة»),
// so that tap unlocks two shared audio elements (the teacher's voice, the reciter)
// and the speech engine; the lesson then reuses those same elements, which stay
// allowed to play even though the first line arrives seconds later from the server.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

const elements: Partial<Record<'voice' | 'reciter', HTMLAudioElement>> = {};

/** The shared element for the teacher's voice or the reciter. */
export function lessonAudio(kind: 'voice' | 'reciter'): HTMLAudioElement {
  return (elements[kind] ??= new Audio());
}

let ctx: AudioContext | null = null;

/** The shared Web Audio context for the teacher's lip-sync (created and resumed on a tap). */
export function lessonAudioContext(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const Ctor =
      globalThis.AudioContext ??
      (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    ctx = Ctor ? new Ctor() : null;
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Call from a tap handler (start / resume / the small play button). Never throws. */
export function unlockLessonAudio(): void {
  try {
    void lessonAudioContext()
      ?.resume()
      .catch(() => {});
    for (const kind of ['voice', 'reciter'] as const) {
      const el = lessonAudio(kind);
      if (el.src && !el.paused) continue; // already playing
      el.src = SILENT_WAV;
      void el.play().catch(() => {});
    }
    if (typeof speechSynthesis !== 'undefined') {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
    }
  } catch {
    // unsupported — the lesson's small play button covers it
  }
}
