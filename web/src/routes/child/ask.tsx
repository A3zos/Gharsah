// «اسألني» — the child asks the teacher about their faith, on the AI server's «اسأل وجاوب»
// mode (askRuntime.ts: ServerAskService; «not connected» when no AI server is configured).
// Same stage as the live lesson call (teacher sprite per locale / gender, name pill), no
// timer. States in askState.ts. The mic = the browser's speech recognition (askVoice.ts); the
// teacher speaks every answer (/speak, lip-synced) and the bubble shows it exactly as received.
// expects "none" (the child said goodbye) → the goodbye, then home.
import { useEffect, useReducer, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';

import { paths } from '../../app/paths';
import { askEnabled, NotConnectedAskService, type AskService } from '../../ask/AskService';
import { createAskRuntime, type AskTeacherVoice } from '../../ask/askRuntime';
import { askReducer, initialAskState, MAX_QUESTION_LENGTH, type AskState } from '../../ask/askState';
import type { AskVoice } from '../../ask/askVoice';
import type { AskAnswer } from '../../ask/AskService';
import { AskBubbleIcon } from '../../components/child/childIcons';
import { useChildData } from '../../components/child/ChildData';
import { type TeacherGender } from '../../components/child/teacherCharacter';
import { useChildTitle } from '../../components/child/useChildTitle';
import { CallFrame, TeacherStage } from '../../components/lesson/LessonView';
import { C } from '../../components/ui/color';
import {
  ASK_CATEGORIES,
  askCategoryLabel,
  askQuestionLabel,
  type AskCategoryId,
} from '../../content/askSuggestions';
import { askPreviewState } from '../../dev/askPreview';
import { MESSAGES, useI18n } from '../../i18n/i18n';
import { cx } from '../../lib/cx';
import { DESKTOP, useMedia } from '../../lib/useMedia';
import type { Route } from './+types/ask';

export const meta: Route.MetaFunction = () => [{ title: MESSAGES.ar.child.ask.title }];

export default function AskRoute() {
  const { child } = useChildData();
  const { m } = useI18n();
  const { search } = useLocation();
  useChildTitle(m.child.ask.title);
  const [initial] = useState(() => askPreviewState(search) ?? initialAskState);
  if (!askEnabled()) return <Navigate to={paths.child.home} replace />;
  if (!child) return <div aria-busy="true" className="min-h-dvh bg-background" />;
  return <AskConnected child={child} initial={initial} />;
}

/** One visit: the session, the mic and the teacher's voice (askRuntime.ts), released on leave. */
function AskConnected({
  child,
  initial,
}: {
  child: { id: string; name: string; gender: TeacherGender };
  initial: AskState;
}) {
  const { lang } = useI18n();
  const [rt] = useState(() =>
    createAskRuntime({ childId: child.id, childName: child.name, gender: child.gender, uiLang: lang }),
  );
  useEffect(() => () => rt.dispose(), [rt]);
  return (
    <AskScreen
      gender={child.gender}
      initial={initial}
      service={rt.service}
      voice={rt.voice}
      teacher={rt.teacher}
    />
  );
}

/** Thinking longer than this (a cold start) → «لحظة أجهّز لك الجواب…». */
export const ASK_SLOW_MS = 4000;
/** After the goodbye has been said: back to the child home. */
export const ASK_GOODBYE_HOME_MS = 2000;

export function AskScreen({
  gender,
  initial = initialAskState,
  service: injected,
  voice = null,
  teacher = null,
}: {
  gender: TeacherGender;
  initial?: AskState;
  service?: AskService;
  /** Speech recognition; null = this browser has none (keyboard + chips only). */
  voice?: AskVoice | null;
  /** The teacher's voice (/speak); null = no voice (not connected). */
  teacher?: AskTeacherVoice | null;
}) {
  const { lang, m } = useI18n();
  const t = m.child.ask;
  const desktop = useMedia(DESKTOP);
  const navigate = useNavigate();
  const [s, dispatch] = useReducer(askReducer, initial);
  const [service] = useState<AskService>(() => injected ?? new NotConnectedAskService());
  // the line the teacher finished saying / the question that has waited long (set from callbacks)
  const [saidDone, setSaidDone] = useState<string | null>(null);
  const [slowFor, setSlowFor] = useState<AskState['question']>(null);
  const teacherRef = useRef(teacher);

  // the screen opened: start the session now (a cold start overlaps the greeting)
  useEffect(() => service.warm?.(), [service]);

  // listening: the browser's speech recognition → the child's words
  useEffect(() => {
    if (s.phase !== 'listening' || !voice) return;
    teacherRef.current?.stop();
    const ac = new AbortController();
    void voice.listen(ac.signal).then((r) => {
      if (ac.signal.aborted) return;
      dispatch(
        typeof r === 'object'
          ? { type: 'heard', text: r.text }
          : { type: r === 'denied' ? 'micBlocked' : 'notHeard' },
      );
    });
    return () => ac.abort();
  }, [s.phase, voice]);

  // thinking: the service; a long wait (cold start) gets a gentle line
  const question = s.question;
  useEffect(() => {
    if (s.phase !== 'thinking') return;
    let live = true;
    const slowTimer = setTimeout(() => live && setSlowFor(question), ASK_SLOW_MS);
    const text = question?.kind === 'text' ? question.text : '';
    (text ? service.ask(text, lang) : Promise.reject(new Error('nothing transcribed')))
      .then((result) => live && dispatch({ type: 'result', result }))
      .catch(() => live && dispatch({ type: 'failed' }));
    return () => {
      live = false;
      clearTimeout(slowTimer);
    };
  }, [s.phase, question, service, lang]);

  // an answer / the goodbye: the teacher says it (lip-synced); after the goodbye → home
  const said = s.phase === 'answer' || s.phase === 'goodbye' ? (s.answer?.text ?? '') : '';
  const phase = s.phase;
  useEffect(() => {
    if (!said) return;
    let live = true;
    let home: ReturnType<typeof setTimeout> | undefined;
    const voiced = teacherRef.current ? teacherRef.current.speak(said).catch(() => {}) : Promise.resolve();
    void voiced.then(() => {
      if (!live) return;
      setSaidDone(said);
      if (phase === 'goodbye') home = setTimeout(() => navigate(paths.child.home), ASK_GOODBYE_HOME_MS);
    });
    return () => {
      live = false;
      clearTimeout(home);
      teacherRef.current?.stop();
    };
  }, [said, phase, navigate]);
  const talking = !!teacher && !!said && saidDone !== said;
  const slow = s.phase === 'thinking' && slowFor === question;

  useEffect(() => () => teacherRef.current?.stop(), []);

  const answered = s.phase === 'answer' || s.phase === 'goodbye';
  const sources = s.answer && 'sources' in s.answer ? s.answer.sources : [];
  const line = answered
    ? (s.answer?.text ?? '')
    : s.phase === 'idle'
      ? s.note
        ? t[s.note]
        : t.greeting[gender]
      : s.phase === 'listening'
        ? t.listening
        : s.phase === 'thinking'
          ? slow
            ? t.preparing
            : t.thinking
          : s.phase === 'notReady'
            ? t.notReady
            : s.phase === 'sensitive' || s.phase === 'offTopic'
              ? t.askParent
              : null;

  return (
    <CallFrame desktop={desktop}>
      <AskHeader title={t.title} closeLabel={t.close} onClose={() => navigate(paths.child.home)} />
      <TeacherStage
        gender={gender}
        desktop={desktop}
        pose={s.phase === 'listening' ? 'listening' : s.phase === 'thinking' ? 'quiet' : 'speaking'}
        talking={talking}
        mouth={teacher?.mouth}
        happy={s.phase === 'notReady' || s.phase === 'answer' || s.phase === 'goodbye'}
        compact={s.phase === 'answer' && sources.length > 0}
      >
        {line && (
          <p
            role="status"
            aria-live="polite"
            // the server's answer: exactly as received, its own direction; a long one scrolls
            dir={answered ? 'auto' : undefined}
            className={cx(
              'relative m-0 max-w-[440px] rounded-px-22 bg-green-tint px-[18px] py-[12px] text-center text-[17px] leading-[1.75] font-bold text-text-dark',
              answered && 'max-h-[34dvh] overflow-y-auto',
            )}
          >
            {line}
            {s.phase === 'thinking' && <ThinkingDots />}
          </p>
        )}
      </TeacherStage>
      <div className="flex min-h-0 grow flex-col gap-[12px] overflow-y-auto">
        {(s.phase === 'idle' || s.phase === 'answer') && (
          <Suggestions onAsk={(text) => dispatch({ type: 'ask', text })} />
        )}
        {s.phase === 'listening' && (
          <div className="flex min-h-[92px] items-center justify-center rounded-px-24 border-[2px] border-dashed border-input-border bg-surface px-[16px] text-[15px] font-bold text-text-subtle">
            {t.transcriptPlaceholder}
          </div>
        )}
        {(s.phase === 'thinking' ||
          s.phase === 'notReady' ||
          s.phase === 'sensitive' ||
          s.phase === 'offTopic') && (
          <QuestionBack state={s} parent={s.phase === 'sensitive' || s.phase === 'offTopic'} />
        )}
        {s.phase === 'answer' && sources.length > 0 && <AnswerCard state={s} />}
      </div>
      {s.phase === 'idle' || s.phase === 'listening' || s.phase === 'answer' ? (
        <AskInputs listening={s.phase === 'listening'} mic={voice !== null} dispatch={dispatch} />
      ) : s.phase === 'thinking' || s.phase === 'goodbye' ? null : (
        <button
          type="button"
          onClick={() => dispatch({ type: 'again' })}
          className="flex h-[62px] shrink-0 cursor-pointer items-center justify-center rounded-px-22 border-0 bg-gold font-heading text-[20px] font-bold text-on-gold"
        >
          {t.askAnother}
        </button>
      )}
    </CallFrame>
  );
}

function AskHeader({
  title,
  closeLabel,
  onClose,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="flex w-full shrink-0 items-center gap-[11px]">
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="flex h-[48px] w-[48px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-surface p-0"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6 L18 18 M18 6 L6 18" stroke={C.textMuted} strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </button>
      <h1 className="m-0 flex grow items-center justify-center gap-[8px] font-heading text-[22px] font-bold text-deep-green">
        <AskBubbleIcon size={26} />
        {title}
      </h1>
      <span className="w-[48px] shrink-0" />
    </div>
  );
}

function ThinkingDots() {
  return (
    <span className="ms-[6px] inline-flex gap-[4px] align-middle" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-[8px] w-[8px] animate-[gh-blink_1.2s_ease-in-out_infinite] rounded-full bg-primary"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </span>
  );
}

/** Suggested questions in four categories (labels only — content/askSuggestions.ts). */
function Suggestions({ onAsk }: { onAsk: (text: string) => void }) {
  const { lang, m } = useI18n();
  const [cat, setCat] = useState<AskCategoryId>(ASK_CATEGORIES[0].id);
  const current = ASK_CATEGORIES.find((c) => c.id === cat)!;
  return (
    <section aria-label={m.child.ask.suggestions} className="flex flex-col gap-[10px]">
      <div
        role="tablist"
        aria-label={m.child.ask.suggestions}
        className="flex gap-[8px] overflow-x-auto pb-[2px]"
      >
        {ASK_CATEGORIES.map((c) => {
          const on = c.id === cat;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setCat(c.id)}
              className={cx(
                'h-[44px] shrink-0 cursor-pointer rounded-pill px-[16px] text-[14.5px] font-extrabold whitespace-nowrap',
                on
                  ? 'border-0 bg-deep-green text-surface'
                  : 'border-[1.5px] border-border bg-surface text-text-muted',
              )}
            >
              {askCategoryLabel(lang, c.id)}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="flex flex-col gap-[8px]">
        {current.questions.map((q) => {
          const label = askQuestionLabel(lang, current.id, q);
          return (
            <button
              key={q}
              type="button"
              onClick={() => onAsk(label)}
              className="flex min-h-[54px] cursor-pointer items-center gap-[10px] rounded-px-22 border-[1.5px] border-border bg-surface px-[16px] py-[10px] text-start text-[16px] font-bold text-text-dark shadow-soft"
            >
              <span
                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-gold-tint"
                aria-hidden="true"
              >
                <AskBubbleIcon size={17} color={C.ayahBracket} />
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** The big round mic (like the lesson's) + «اكتب سؤالك» for older kids. */
function AskInputs({
  listening,
  mic,
  dispatch,
}: {
  listening: boolean;
  /** Speech recognition available — else the keyboard only (no broken mic). */
  mic: boolean;
  dispatch: (e: Parameters<typeof askReducer>[1]) => void;
}) {
  const t = useI18n().m.child.ask;
  const [typingOn, setTyping] = useState(false);
  const typing = typingOn || !mic;
  const [text, setText] = useState('');
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    dispatch({ type: 'ask', text });
    setText('');
  };
  return (
    <div className="flex shrink-0 flex-col items-center gap-[10px]">
      {typing && !listening && (
        <form onSubmit={send} className="flex w-full items-center gap-[8px]">
          <label className="sr-only" htmlFor="ask-text">
            {t.typeLabel}
          </label>
          <input
            id="ask-text"
            value={text}
            maxLength={MAX_QUESTION_LENGTH}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.typePlaceholder}
            autoFocus={mic}
            className="h-[54px] min-w-0 grow rounded-px-20 border-[1.5px] border-input-border bg-surface px-[16px] text-[16px] text-text-dark placeholder:text-placeholder"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="h-[54px] shrink-0 cursor-pointer rounded-px-20 border-0 bg-deep-green px-[18px] text-[16px] font-extrabold text-surface disabled:opacity-50"
          >
            {t.send}
          </button>
        </form>
      )}
      {mic && (
        <button
          type="button"
          onClick={() => dispatch({ type: 'micTap' })}
          aria-label={listening ? t.micStop : t.mic}
          aria-pressed={listening}
          className="relative flex h-[88px] w-[88px] cursor-pointer items-center justify-center rounded-full border-0 bg-gold p-0 shadow-lesson-mic-live"
        >
          {listening && (
            <>
              <span className="absolute inset-0 animate-[gh-glow-2_1.5s_ease-out_infinite] rounded-full bg-mic-pulse" />
              <span className="absolute -inset-[10px] animate-[gh-glow-2_1.5s_ease-out_.5s_infinite] rounded-full bg-mic-pulse" />
            </>
          )}
          <svg className="relative" width="38" height="38" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect
              x="9"
              y="3"
              width="6"
              height="11"
              rx="3"
              fill={C.surface}
              stroke={C.surface}
              strokeWidth="2"
            />
            <path
              d="M5.5 11.5 C5.5 15.1 8.4 18 12 18 C15.6 18 18.5 15.1 18.5 11.5 M12 18 V21.2"
              stroke={C.surface}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
      {mic && !listening && (
        <button
          type="button"
          onClick={() => setTyping((v) => !v)}
          aria-expanded={typing}
          className="min-h-[44px] cursor-pointer border-0 bg-transparent px-[12px] text-[14.5px] font-bold text-deep-green underline-offset-4 hover:underline"
        >
          {t.typeToggle}
        </button>
      )}
    </div>
  );
}

/** «سؤالك جميل…» / «اسأل وليّ أمرك»: the child's question shown back. */
function QuestionBack({ state: s, parent }: { state: AskState; parent: boolean }) {
  const t = useI18n().m.child.ask;
  return (
    <div
      className={cx(
        'flex flex-col gap-[8px] rounded-px-24 px-[18px] py-[16px]',
        parent ? 'border-[1.5px] border-gold-border bg-gold-tint' : 'border-[1.5px] border-border bg-surface',
      )}
    >
      <span className="text-[13px] font-extrabold text-text-muted">{t.yourQuestion}</span>
      {/* the child's own words: their direction follows them */}
      <span
        dir={s.question?.kind === 'text' ? 'auto' : undefined}
        className="text-[17px] leading-[1.7] font-bold text-text-dark"
      >
        {s.question?.kind === 'text' ? s.question.text : t.voiceQuestion}
      </span>
    </div>
  );
}

/** The future answer (dev preview only for now): the text, «المصدر» chips, «اسأل وليّ أمرك أيضًا». */
function AnswerCard({ state: s }: { state: AskState }) {
  const t = useI18n().m.child.ask;
  const a = s.answer as AskAnswer;
  return (
    <article className="flex flex-col gap-[14px] rounded-px-28 border-[1.5px] border-border bg-surface px-[20px] py-[18px] shadow-card">
      {s.question?.kind === 'text' && (
        <span dir="auto" className="text-[14px] font-extrabold text-text-muted">
          {s.question.text}
        </span>
      )}
      <p dir="auto" className="m-0 text-[17px] leading-[1.9] text-text-dark">
        {a.text}
      </p>
      {a.sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-[8px]">
          <span className="text-[13px] font-extrabold text-text-muted">{t.source}</span>
          {a.sources.map((src) =>
            src.url ? (
              <a
                key={src.label}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-pill bg-green-tint px-[12px] py-[6px] text-[13px] font-extrabold text-deep-green no-underline"
              >
                {src.label}
              </a>
            ) : (
              <span
                key={src.label}
                className="rounded-pill bg-border-soft px-[12px] py-[6px] text-[13px] font-extrabold text-text-muted"
              >
                {src.label}
              </span>
            ),
          )}
        </div>
      )}
      <span className="flex items-center gap-[8px] rounded-px-16 bg-gold-tint px-[12px] py-[9px] text-[13px] font-bold text-warning-text">
        <AskBubbleIcon size={16} color={C.ayahBracket} />
        {t.askParentToo}
      </span>
    </article>
  );
}
