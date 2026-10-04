// Wires a ServerLesson for the browser (VITE_AI_AGENT=1): the AI server client,
// the per-child device id, the verified local Quran text, and the browser ports.
import textJson from '@content/quran/quran_text.json';

import { quranMeta } from '../../content/library';
import type { ChildRef } from '../../data/student';
import { QuranText, quranRef } from '../quran';
import { LipSync } from './lipSync';
import { LessonMicrophone } from './microphone';
import { AgentApi, firstName, type AgentLang, type Gender } from '../server/api';
import { APP_UI_LANGUAGE } from '../../i18n/i18n';
import {
  BrowserSpeechInput,
  HtmlUrlPlayer,
  MediaUtteranceRecorder,
  MicPresenceListener,
  ServerTeacherVoice,
} from './serverPorts';
import { agentDeviceId } from '../server/device';
import { loadRecitationWaitSay } from '../server/waitLine';
import type { ServerProgressSink } from '../server/progressMap';
import { ServerLesson, type LessonPlan } from '../server/serverLesson';
import { SupabaseServerProgressSink } from './serverProgressSink';
import { createTtsProvider } from '../voice/tts';
import { createRecitationVerifier } from '../voice/recitationVerifier';

const verified = QuranText.fromJson(textJson);

export interface WebServerLesson {
  lesson: ServerLesson;
  /** The teacher's mouth (lip-sync) for the character. */
  mouth: LipSync['frame'];
  dispose(): void;
}

export async function createServerLesson(o: {
  baseUrl: string;
  /** Today's pilot-plan lesson (no choosing). */
  plan: LessonPlan;
  session: ChildRef;
  gender: Gender;
  /** The child's name: its first word goes in /agent/start; scrubbed from everything else sent. */
  childName: string;
  /** The session language (default: the app's UI language — Arabic today). */
  lang?: AgentLang;
  /** Where today's lesson starts (the surah unless it was finished earlier today). */
  startAt?: 'quran' | 'hadith';
  sink?: ServerProgressSink;
}): Promise<WebServerLesson> {
  const lang = o.lang ?? APP_UI_LANGUAGE;
  const api = new AgentApi(o.baseUrl, undefined, [o.childName]);
  void loadRecitationWaitSay(api); // once per app load (usually done already by the child home)
  // the lesson screen mounted: wake the recitation model before /agent/start (debounced)
  void api.warmRecitation();
  const mic = new LessonMicrophone();
  const lip = new LipSync();
  const voice = new ServerTeacherVoice(
    createTtsProvider(api, lang),
    o.gender,
    undefined,
    undefined,
    lip,
    lang,
  );
  const player = new HtmlUrlPlayer();
  const lesson = new ServerLesson({
    api,
    plan: o.plan,
    voice,
    player,
    presence: new MicPresenceListener(mic),
    sink: o.sink ?? new SupabaseServerProgressSink(o.session),
    deviceId: await agentDeviceId(o.session.childId, browserStorage()),
    // the teacher greets the child by first name — /agent/start only (still scrubbed elsewhere)
    childFirstName: firstName(o.childName),
    gender: o.gender,
    lang,
    startAt: o.startAt ?? 'quran',
    // the teacher always hears the child (PO, 2026-10-04; disclosed at sign-up)
    recorder: MediaUtteranceRecorder.supported() ? new MediaUtteranceRecorder(mic) : null,
    speechInput: BrowserSpeechInput.create(lang),
    verifier: createRecitationVerifier(),
    verifiedAyah: (s, a) => (verified.has(quranRef(s, a)) ? verified.text(quranRef(s, a)) : null),
    ayahCount: (s) => quranMeta.ayahCount(s),
    surahName: (s) => quranMeta.surahName(s),
  });
  let disposed = false;
  return {
    lesson,
    mouth: lip.frame,
    dispose() {
      // the whole AI engine: requests, speech, reciter, mic, lip-sync (idempotent)
      if (disposed) return;
      disposed = true;
      lesson.dispose();
      voice.stop();
      player.stop();
      mic.close();
      lip.dispose();
    },
  };
}

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // blocked (privacy mode) — a fresh id for this visit
  }
}
