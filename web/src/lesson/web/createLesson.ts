// Wires a LessonAgent for the browser: verified local content, the reciter audio
// (bundled, or downloaded once + sha256-checked into Cache Storage), the interim
// speech teacher (+ the AI server's voice via ai-speak when VITE_AI_VOICE=1), the
// WAV project recorder and the Supabase progress sink.
import { lessonLog } from '../lessonLog';
import manifestJson from '@content/audio/quran/manifest.json';
import textJson from '@content/quran/quran_text.json';

import { hadithRepo, projectRepo, quranMeta } from '../../content/library';
import type { ChildRef } from '../../data/student';
import { LessonAgent, type LessonContent } from '../agent';
import { QuranAudioRepository, RecitationManifest, type AudioCacheStore } from '../audioRepository';
import type { LessonProgressSink } from '../ports';
import { QuranText } from '../quran';
import type { LessonScript } from '../script';
import type { LessonProgress } from '../state';
import { TeacherLineBank, type LineLang } from '../teacherLines';
import { LipSync } from './lipSync';
import { LessonMicrophone } from './microphone';
import { SupabaseProgressSink } from './progressSink';
import { HtmlRecitationPlayer } from './recitationPlayer';
import { MAX_REPORT_MS, WavProjectRecorder } from './recorder';
import { aiSpeakPost, ServerVoice, serverVoiceEnabled } from './serverVoice';
import { SpeechTeacher } from './speechTeacher';
import { aiServerUrl, createProjectVerifier } from './projectVerifier';
import type { RawLineVoice } from '../ports';

const CACHE_NAME = 'gharsah-quran-audio-v1';
const cacheKey = (name: string) => `/__quran-audio-cache/${name}`;

/** Downloaded reciter audio in Cache Storage; players get object URLs. */
export class CacheStorageAudioStore implements AudioCacheStore {
  private readonly urls = new Map<string, string>();

  private open(): Promise<Cache> {
    if (typeof caches === 'undefined') return Promise.reject(new Error('Cache Storage unavailable'));
    return caches.open(CACHE_NAME);
  }

  async read(name: string): Promise<Uint8Array | null> {
    const hit = await (await this.open()).match(cacheKey(name));
    return hit ? new Uint8Array(await hit.arrayBuffer()) : null;
  }

  async write(name: string, bytes: Uint8Array): Promise<void> {
    await (await this.open()).put(cacheKey(name), new Response(bytes.slice().buffer));
    this.revoke(name);
  }

  async delete(name: string): Promise<void> {
    await (await this.open()).delete(cacheKey(name));
    this.revoke(name);
  }

  async pathFor(name: string): Promise<string> {
    const known = this.urls.get(name);
    if (known) return known;
    const bytes = await this.read(name);
    if (!bytes) throw new Error(`Not cached: ${name}`);
    const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: 'audio/mpeg' }));
    this.urls.set(name, url);
    return url;
  }

  dispose(): void {
    for (const name of [...this.urls.keys()]) this.revoke(name);
  }

  private revoke(name: string): void {
    const url = this.urls.get(name);
    if (url) URL.revokeObjectURL(url);
    this.urls.delete(name);
  }
}

export async function browserSha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

export interface WebLesson {
  agent: LessonAgent;
  /** Where the lesson resumes from (pass to agent.start). */
  progressFrom: LessonProgress | undefined;
  /** True while the teacher's lines can't be voiced at all (captions only). */
  voiceMissing: { readonly value: boolean; subscribe: SpeechTeacher['voiceMissing'] };
  /** The teacher's mouth (lip-sync) for the character. */
  mouth: LipSync['frame'];
  /** Resolves when the teacher's server voice is ready (or failed) — start after it. */
  voiceReady(): Promise<unknown>;
  dispose(): Promise<void>;
}

export function createWebLesson(o: {
  script: LessonScript;
  session: ChildRef;
  childFirstName: string;
  progressFrom?: LessonProgress;
  /** Replaces the Supabase sink (the DEV-only child preview keeps progress in memory). */
  sink?: LessonProgressSink;
  /** The UI language the teacher speaks (default Arabic). Ayat / hadith stay Arabic. */
  lang?: LineLang;
  /** The child's gender — the AI server's /speak voice for the project check's message. */
  gender?: 'boy' | 'girl';
  /** The project check's «busy» line in the UI language (lesson.project.busy). */
  verifyBusyMessage?: string;
}): WebLesson {
  const cache = new CacheStorageAudioStore();
  const content: LessonContent = {
    meta: quranMeta,
    text: QuranText.fromJson(textJson),
    audio: new QuranAudioRepository({
      meta: quranMeta,
      manifest: RecitationManifest.fromJson(manifestJson),
      cache,
      fetch: fetchBytes,
      sha256: browserSha256,
    }),
    hadith: hadithRepo,
    projects: projectRepo,
  };
  const mic = new LessonMicrophone();
  const player = new HtmlRecitationPlayer('/');
  // The DEV preview (a local sink) has no paired session — browser voice only there.
  const server = serverVoiceEnabled() && !o.sink ? new ServerVoice(aiSpeakPost) : null;
  server?.warm();
  const lip = new LipSync();
  const lang = o.lang ?? 'ar';
  const teacher = new SpeechTeacher(mic, undefined, server, lip, lang);
  const recorder = new WavProjectRecorder(mic);
  // the project check's message (the AI server's own words) through its /speak, lip-synced
  const aiBase = o.sink ? null : aiServerUrl();
  const rawVoice = aiBase ? lazyServerVoice(aiBase, lang, o.gender ?? 'boy', lip) : undefined;
  const agent = new LessonAgent({
    script: o.script,
    content,
    teacher,
    player,
    recorder,
    sink: o.sink ?? new SupabaseProgressSink(o.session, o.script),
    // the project report's voice check on the AI server (not in the DEV preview's local sink)
    projectVerifier: o.sink
      ? undefined
      : createProjectVerifier({ childId: o.session.childId, lang, busyMessage: o.verifyBusyMessage ?? '' }),
    rawVoice,
    // ~600 ms of quiet after a question before the mic listens (a natural pause)
    // A pure voice call: ~6 s of silence → one nudge, again → the step continues by
    // itself; a blocked mic → «سماح», then listen-only.
    // + the dead-end guard: 8 s with nothing happening → recover (logged)
    timings: {
      maxRecordingMs: MAX_REPORT_MS,
      echoGuardMs: 600,
      voiceOnly: true,
      silenceMs: 6000,
      watchdogMs: 8000,
    },
    // the teacher's lines (and silent captions) in the UI language — Arabic unchanged
    lineBank: new TeacherLineBank(lang),
    log: (m, e) => lessonLog('builtin', m, e === undefined ? undefined : String((e as Error)?.message ?? e)),
    childFirstName: o.childFirstName,
    debugTapCountsRepeat: import.meta.env.DEV,
  });
  let disposed = false;
  return {
    agent,
    progressFrom: o.progressFrom,
    mouth: lip.frame,
    voiceReady: () => server?.whenReady() ?? Promise.resolve(false),
    voiceMissing: {
      get value() {
        return teacher.isVoiceMissing;
      },
      subscribe: teacher.voiceMissing,
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      await agent.dispose().catch(() => {});
      rawVoice?.stop();
      await Promise.all([teacher.dispose(), recorder.dispose(), player.dispose()]).catch(() => {});
      mic.close();
      cache.dispose();
      lip.dispose();
    },
  };
}

/**
 * The AI server's /speak voice for text outside the line bank (the project check's message),
 * loaded on first use — its modules stay out of the lesson's initial (and prerendered) bundle.
 */
function lazyServerVoice(base: string, lang: LineLang, gender: 'boy' | 'girl', lip: LipSync): RawLineVoice {
  let voice: Promise<{ speak(t: string): Promise<void>; stop(): void }> | null = null;
  const get = () =>
    (voice ??= Promise.all([import('../server/api'), import('../voice/tts'), import('./serverPorts')]).then(
      ([api, tts, ports]) =>
        new ports.ServerTeacherVoice(
          tts.createTtsProvider(new api.AgentApi(base), lang),
          gender,
          undefined,
          undefined,
          lip,
          lang,
        ),
    ));
  return {
    speak: async (text) => (await get()).speak(text),
    stop: () => void voice?.then((v) => v.stop()),
  };
}
