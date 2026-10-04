// «اسألني» on the AI server's «اسأل وجاوب» mode (ai/API_web.md §1.1, mode "open"): one stage
// "qa", expects "text" for every answer, "none" once the child says goodbye. One session per
// screen visit (started when the screen opens, so a cold start overlaps the greeting).
// Never /agent/score-recitation here. The child's first name goes in /agent/start only;
// AgentApi scrubs it from every message.
import {
  type AgentApi,
  type AgentLang,
  type Gender,
  RateLimited,
  SessionExpired,
} from '../lesson/server/api';
import type { ServerTurn } from '../lesson/server/parse';
import type { AskResult, AskService } from './AskService';

/** HTTP 429: wait this long, then retry once (ai/API_web.md). */
export const ASK_RATE_LIMIT_WAIT_MS = 3000;

/** One line of window.__askLog — the question text, never audio. */
export interface AskLogEntry {
  readonly at: string;
  readonly question: string;
  readonly status: 'ok' | 'goodbye' | 'restarted' | 'rateLimited' | 'failed';
  readonly ms: number;
  readonly say: string;
}

const LOG_SIZE = 100;

export function askLog(entry: AskLogEntry): void {
  const g = globalThis as { __askLog?: AskLogEntry[] };
  const log = (g.__askLog ??= []);
  log.push(entry);
  if (log.length > LOG_SIZE) log.splice(0, log.length - LOG_SIZE);
}

export class ServerAskService implements AskService {
  private session: Promise<string> | null = null;

  constructor(
    private readonly o: {
      api: AgentApi;
      deviceId: () => Promise<string>;
      gender: Gender;
      lang: AgentLang;
      /** The child's first name for /agent/start (omitted when empty). */
      childName?: string | null;
      /** For the log only (the API scrubs what it sends): the child's name → «بطل». */
      redact?: (text: string) => string;
      sleep?: (ms: number) => Promise<void>;
      now?: () => number;
    },
  ) {}

  /** Start the session now (the screen opened) — the cold start runs while the child reads. */
  warm(): void {
    void this.start().catch(() => {});
  }

  private start(): Promise<string> {
    this.session ??= (async () => {
      const { api, gender, lang } = this.o;
      const deviceId = await this.o.deviceId();
      const t = await api.start({
        mode: 'open',
        gender,
        deviceId,
        lang,
        childName: this.o.childName ?? null,
      });
      return t.sessionId;
    })().catch((e: unknown) => {
      this.session = null; // the next question tries again
      throw e;
    });
    return this.session;
  }

  async ask(question: string): Promise<AskResult> {
    const now = this.o.now ?? Date.now;
    const sleep = this.o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    const t0 = now();
    let status: AskLogEntry['status'] = 'ok';
    const send = async (): Promise<ServerTurn> => this.o.api.message(await this.start(), question, 'open');
    try {
      let turn: ServerTurn;
      try {
        turn = await send();
      } catch (e) {
        if (e instanceof SessionExpired) {
          // the session expired: a fresh one, silently, and the same question again
          status = 'restarted';
          this.session = null;
          turn = await send();
        } else if (e instanceof RateLimited) {
          status = 'rateLimited';
          await sleep(ASK_RATE_LIMIT_WAIT_MS);
          turn = await send();
        } else throw e;
      }
      const goodbye = turn.expects === 'none';
      if (goodbye) {
        status = 'goodbye';
        this.session = null; // a new question would need a new session
      }
      this.log(question, status, now() - t0, turn.say);
      return goodbye ? { kind: 'goodbye', text: turn.say } : { kind: 'answer', text: turn.say, sources: [] };
    } catch (e) {
      this.log(question, 'failed', now() - t0, String((e as Error)?.message ?? e));
      throw e; // → the screen's notReady line (never technical text)
    }
  }

  private log(question: string, status: AskLogEntry['status'], ms: number, say: string): void {
    askLog({
      at: new Date().toISOString(),
      question: this.o.redact ? this.o.redact(question) : question,
      status,
      ms,
      say: say.slice(0, 120),
    });
  }
}
