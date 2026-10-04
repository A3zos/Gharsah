// The project report's voice check on the AI server: POST /agent/actions/verify with the
// child's recording (ai/API_web.md — `lang` 2026-10-04). The server marks a verified project
// done itself (we never call /agent/actions/done after it). Its `message` is shown / said
// exactly as received. No X-Device-Token: we never claimed one for /agent/actions/done.
import { lessonLog } from '../lessonLog';
import { AgentApi, type AgentLang } from '../server/api';
import { agentDeviceId } from '../server/device';
import type { ProjectVerdict, ProjectVerifier } from '../ports';

/** Our project ids → the AI server's hadith ids (6 «لا تغضب», 9 «بر الوالدين», 10 «الكذب»). */
export const SERVER_HADITH_BY_PROJECT: Readonly<Record<string, number>> = {
  'birr-3-acts': 9,
};

/** The AI server's base URL for the project check (VITE_AI_BASE_URL — the lesson may be built-in). */
export function aiServerUrl(): string | null {
  const url = (import.meta.env.VITE_AI_BASE_URL as string | undefined)?.trim();
  return url ? url : null;
}

export class AgentProjectVerifier implements ProjectVerifier {
  constructor(
    private readonly o: {
      api: Pick<AgentApi, 'verifyAction'>;
      deviceId: () => Promise<string>;
      lang: AgentLang;
      toBase64?: (b: Blob) => Promise<string>;
      /** The friendly line when the check is unavailable (lesson.project.busy, the session language). */
      busyMessage: string;
    },
  ) {}

  get busyMessage(): string {
    return this.o.busyMessage;
  }

  async verify({ projectId, audio }: Parameters<ProjectVerifier['verify']>[0]): Promise<ProjectVerdict> {
    const hadithId = SERVER_HADITH_BY_PROJECT[projectId];
    if (!hadithId || !audio.blob) return { kind: 'skip' };
    const t0 = Date.now();
    let r;
    try {
      const audioBase64 = await (this.o.toBase64 ?? blobToBase64)(audio.blob);
      r = await this.o.api.verifyAction({
        deviceId: await this.o.deviceId(),
        hadithId,
        audioBase64,
        lang: this.o.lang,
      });
    } catch (e) {
      // never technical text on screen — the log only
      lessonLog('builtin', 'project check failed', {
        error: String((e as Error)?.message ?? e),
        ms: Date.now() - t0,
      });
      return { kind: 'unavailable' };
    }
    lessonLog('builtin', 'project check', {
      available: r.available,
      ...(r.available ? { verified: r.verified, message: r.message } : {}),
      ms: Date.now() - t0,
    });
    if (!r.available) return { kind: 'unavailable' };
    return r.verified
      ? { kind: 'verified', message: r.message }
      : { kind: 'notVerified', message: r.message };
  }
}

/** The verifier for a child, or none (no AI server configured → the report is saved as before). */
export function createProjectVerifier(o: {
  childId: string;
  lang: AgentLang;
  busyMessage: string;
}): ProjectVerifier | undefined {
  const base = aiServerUrl();
  if (!base) return undefined;
  const api = new AgentApi(base);
  return new AgentProjectVerifier({
    api,
    lang: o.lang,
    busyMessage: o.busyMessage,
    deviceId: () => agentDeviceId(o.childId, browserStorage()),
  });
}

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The recording as base64 for the JSON body (chunked: no call-stack overflow on long audio). */
async function blobToBase64(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
