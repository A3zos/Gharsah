// Wires a ServerLesson for the browser (VITE_AI_AGENT=1): the AI server client,
// the per-child device id, the verified local Quran text, and the browser ports.
import textJson from '@content/quran/quran_text.json';

import { quranMeta } from '../../content/library';
import type { ChildRef } from '../../data/student';
import { QuranText, quranRef } from '../quran';
import { LessonMicrophone } from './microphone';
import { AgentApi, type Gender } from '../server/api';
import {
  BrowserSpeechInput,
  HtmlUrlPlayer,
  MediaUtteranceRecorder,
  MicPresenceListener,
  ServerTeacherVoice,
} from './serverPorts';
import { agentDeviceId } from '../server/device';
import type { ServerProgressSink } from '../server/progressMap';
import { ServerLesson, type LessonPlan } from '../server/serverLesson';
import { SupabaseServerProgressSink } from './serverProgressSink';

const verified = QuranText.fromJson(textJson);

export interface WebServerLesson {
  lesson: ServerLesson;
  dispose(): void;
}

export async function createServerLesson(o: {
  baseUrl: string;
  /** Today's pilot-plan lesson (no choosing). */
  plan: LessonPlan;
  session: ChildRef;
  gender: Gender;
  /** The child's real name: shown on screen only — scrubbed from anything sent to the AI server. */
  childName: string;
  /** The parent's switch (children.ai_voice_consent). */
  consent: boolean;
  sink?: ServerProgressSink;
}): Promise<WebServerLesson> {
  const api = new AgentApi(o.baseUrl, undefined, [o.childName]);
  const mic = new LessonMicrophone();
  const voice = new ServerTeacherVoice(api, o.gender);
  const player = new HtmlUrlPlayer();
  const lesson = new ServerLesson({
    api,
    plan: o.plan,
    voice,
    player,
    presence: new MicPresenceListener(mic),
    sink: o.sink ?? new SupabaseServerProgressSink(o.session),
    deviceId: await agentDeviceId(o.session.childId, browserStorage()),
    gender: o.gender,
    consent: o.consent,
    recorder: o.consent && MediaUtteranceRecorder.supported() ? new MediaUtteranceRecorder(mic) : null,
    speechInput: o.consent ? BrowserSpeechInput.create() : null,
    verifiedAyah: (s, a) => (verified.has(quranRef(s, a)) ? verified.text(quranRef(s, a)) : null),
    ayahCount: (s) => quranMeta.ayahCount(s),
    surahName: (s) => quranMeta.surahName(s),
  });
  return {
    lesson,
    dispose() {
      lesson.dispose();
      voice.stop();
      player.stop();
      mic.close();
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
