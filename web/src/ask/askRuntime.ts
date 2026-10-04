// «اسألني» — everything the screen needs for one visit: the service (the AI server's mode
// "open" when VITE_AI_AGENT + VITE_AI_BASE_URL are set, else «not connected»), the mic (speech
// recognition, or none) and the teacher's voice (/speak in the session language, lip-synced).
import type { MouthSource } from '../components/child/TeacherSprite';
import { aiLessonLanguage, type UiLanguage } from '../i18n/i18n';
import { AgentApi, agentBaseUrl, nameRedactor, type Gender } from '../lesson/server/api';
import { agentDeviceId } from '../lesson/server/device';
import { LipSync } from '../lesson/web/lipSync';
import { ServerTeacherVoice } from '../lesson/web/serverPorts';
import { createTtsProvider } from '../lesson/voice/tts';
import { NotConnectedAskService, type AskService } from './AskService';
import { createAskVoice, type AskVoice } from './askVoice';
import { ServerAskService } from './serverAskService';

export interface AskTeacherVoice {
  speak(text: string): Promise<void>;
  stop(): void;
  mouth?: MouthSource;
}

export interface AskRuntime {
  service: AskService;
  voice: AskVoice | null;
  teacher: AskTeacherVoice | null;
  dispose(): void;
}

export function createAskRuntime(o: {
  childId: string;
  childName: string;
  gender: Gender;
  uiLang: UiLanguage;
}): AskRuntime {
  // the session language follows the UI (AI_LESSON_FOLLOWS_UI)
  const lang = aiLessonLanguage(o.uiLang);
  const voice = createAskVoice(lang);
  const base = agentBaseUrl();
  if (!base)
    return { service: new NotConnectedAskService(), voice, teacher: null, dispose: () => voice?.close() };
  // the child's name: scrubbed from every message (never sent)
  const api = new AgentApi(base, undefined, [o.childName]);
  const lip = new LipSync();
  const tv = new ServerTeacherVoice(createTtsProvider(api, lang), o.gender, undefined, undefined, lip, lang);
  const service = new ServerAskService({
    api,
    deviceId: () => agentDeviceId(o.childId, browserStorage()),
    gender: o.gender,
    lang,
    redact: nameRedactor([o.childName]),
  });
  return {
    service,
    voice,
    teacher: { speak: (text) => tv.speak(text), stop: () => tv.stop(), mouth: lip.frame },
    dispose() {
      tv.stop();
      lip.dispose();
      voice?.close();
    },
  };
}

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
