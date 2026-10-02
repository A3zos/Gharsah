// The live lesson on the AI server (VITE_AI_AGENT=1), rendered from the
// ServerLesson's state only. Same teacher, header and ayah style as the built-in
// lesson. TODO(design): the stages bar, quick replies, the text field, «المعلّم
// يتجهّز» and the projects list have no designed frames yet — built from the
// existing tokens and components until they do.
import { useEffect, useState } from 'react';

import type { ServerLessonState } from '../../lesson/server/serverLesson';
import { HADITH_PLACEHOLDER } from '../../lesson/server/serverLesson';
import { toArabicDigits } from '../../lib/arabicDigits';
import { cx } from '../../lib/cx';
import { TeacherArt } from '../child/TeacherArt';
import { AyahText } from '../ui/AyahText';
import { LiveHeader } from './LessonView';

export interface ServerLessonActions {
  answer(text: string): void;
  continueTapped(): void;
  repeatTapped(): void;
  speakAnswer(): void;
  jumpTo(index: number): void;
  playTapped(): void;
  markProjectDone(hadithId: number): void;
  exit(): void;
  goHome(): void;
}

const NEXT_LABEL = {
  quran: 'ننتقل للقرآن',
  hadith: 'ننتقل للحديث',
  taseem: 'نبدأ التسميع',
  htaseem: 'نبدأ التسميع',
};

export function ServerLessonView({
  state: s,
  actions,
  desktop,
}: {
  state: ServerLessonState;
  actions: ServerLessonActions;
  desktop: boolean;
}) {
  const elapsedMs = useElapsed();
  const body =
    s.phase === 'starting' || s.phase === 'warming' ? (
      <>
        <LiveHeader elapsedMs={elapsedMs} onEnd={actions.exit} />
        <Warming warming={s.phase === 'warming'} />
      </>
    ) : (
      <>
        <LiveHeader elapsedMs={elapsedMs} onEnd={actions.exit} />
        <StagesBar state={s} onJump={actions.jumpTo} />
        <div className="flex shrink-0 items-center gap-[12px]">
          <Teacher state={s} size={desktop ? 150 : 120} />
          <div className="flex min-w-0 grow flex-col gap-[4px]">
            {s.teacher && <span className="text-[16px] font-extrabold text-deep-green">{s.teacher}</span>}
            <p
              aria-live="polite"
              className="m-0 max-h-[30vh] overflow-y-auto text-[18px] leading-[1.7] font-bold"
            >
              {s.caption}
            </p>
          </div>
        </div>
        <Notices state={s} onPlay={actions.playTapped} />
        <div className="flex min-h-0 grow flex-col">
          <Middle state={s} actions={actions} />
        </div>
        <Bottom state={s} actions={actions} />
      </>
    );
  return (
    <main
      className={cx(
        'relative flex h-dvh justify-center overflow-hidden bg-background text-text-dark',
        desktop
          ? 'items-center px-[16px] py-[24px]'
          : 'px-[16px] pt-[max(12px,env(safe-area-inset-top))] pb-[max(12px,env(safe-area-inset-bottom))]',
      )}
    >
      <div
        aria-hidden="true"
        className="absolute -top-[170px] -left-[140px] h-[400px] w-[400px] rounded-full bg-blob-green-strong"
      />
      <div
        className={cx(
          'z-1 flex min-h-0 w-full flex-col gap-[10px]',
          desktop
            ? 'h-full max-h-[760px] w-[580px] max-w-full rounded-px-40 border-[1.5px] border-border bg-surface px-[28px] pt-[22px] pb-[20px] shadow-dark-30-70-10'
            : 'max-w-[520px]',
        )}
      >
        {body}
      </div>
    </main>
  );
}

function useElapsed(): number {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now - start;
}

function Warming({ warming }: { warming: boolean }) {
  return (
    <div className="flex grow flex-col items-center justify-center gap-[18px] text-center" role="status">
      <span className="animate-[gh-bob_1.7s_ease-in-out_infinite]">
        <TeacherArt size={170} mouth="shut" arcs="none" />
      </span>
      <span className="font-heading text-[24px] font-bold">
        {warming ? 'المعلّم يتجهّز… لحظات ونبدأ' : 'نبدأ الحصة…'}
      </span>
      {warming && (
        <span className="text-[16px] leading-[1.8] font-bold text-text-muted">
          أول مرة في اليوم قد تأخذ دقيقة — جهّز نفسك وابتسم.
        </span>
      )}
    </div>
  );
}

function Teacher({ state: s, size }: { state: ServerLessonState; size: number }) {
  const listening = s.repeat === 'listening' || s.hearing;
  const speaking = s.speaking;
  return (
    <span
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      {!s.reciting && (speaking || listening) && (
        <span
          className={cx(
            'absolute inset-0 animate-[gh-glow-2_2.1s_ease-out_infinite] rounded-full',
            listening ? 'bg-glow-listening' : 'bg-glow-speaking',
          )}
        />
      )}
      <span
        className={cx(
          'relative',
          listening
            ? 'animate-[gh-lean_2.6s_ease-in-out_infinite]'
            : speaking && 'animate-[gh-bob_1.7s_ease-in-out_infinite]',
          s.reciting && 'opacity-76',
        )}
      >
        <TeacherArt
          size={size}
          eyeRy={listening ? 11.5 : 10}
          mouth={speaking ? 'open' : 'shut'}
          arcs={speaking ? 'double' : 'none'}
        />
      </span>
    </span>
  );
}

/** Sections already reached can be revisited (/agent/jump); later ones are dimmed. */
function StagesBar({ state: s, onJump }: { state: ServerLessonState; onJump: (i: number) => void }) {
  if (s.stages.length < 2) return null;
  const review = s.segment === 'taseem' || s.segment === 'htaseem';
  return (
    <nav aria-label="مراحل الحصة" className="flex shrink-0 gap-[8px] overflow-x-auto pb-[2px]">
      {s.stages.map((st, i) => {
        const current = i === s.stageIndex;
        const reached = i <= s.maxStageIndex;
        return (
          <button
            key={`${st.id}-${i}`}
            type="button"
            disabled={!reached || current || s.busy || review}
            aria-current={current ? 'step' : undefined}
            onClick={() => onJump(i)}
            className={cx(
              'h-[40px] shrink-0 rounded-pill border-[1.5px] px-[14px] text-[15px] font-extrabold whitespace-nowrap',
              current
                ? 'border-deep-green bg-deep-green text-surface'
                : reached
                  ? 'cursor-pointer border-green-tint bg-green-tint text-deep-green'
                  : 'border-border bg-surface text-text-muted opacity-60',
            )}
          >
            {st.label || toArabicDigits(i + 1)}
          </button>
        );
      })}
    </nav>
  );
}

function Notices({ state: s, onPlay }: { state: ServerLessonState; onPlay: () => void }) {
  const text =
    s.notice === 'rateLimited'
      ? 'المعلّم يأخذ نفَسًا… لحظات ونكمل.'
      : s.notice === 'restarted'
        ? 'خلّنا نبدأ من جديد — نجومك محفوظة.'
        : s.saveFailed
          ? 'لم نتمكّن من حفظ تقدّمك — تحقّق من الاتصال'
          : s.micDenied
            ? 'لا أسمعك — اضغط «ردّدت» بعد ما تردّد، أو اطلب من بابا أو ماما السماح بالميكروفون.'
            : null;
  if (!text && !s.playbackBlocked) return null;
  return (
    <div
      role="alert"
      className="flex shrink-0 items-center gap-[10px] rounded-px-18 bg-gold-tint px-[14px] py-[10px]"
    >
      {text && <span className="grow text-[16px] leading-[1.6] font-bold text-on-gold">{text}</span>}
      {s.playbackBlocked && (
        <button
          type="button"
          onClick={onPlay}
          className="h-[48px] shrink-0 cursor-pointer rounded-px-14 border-0 bg-deep-green px-[16px] text-[16px] font-extrabold text-surface"
        >
          استمع للتلاوة
        </button>
      )}
    </div>
  );
}

function Middle({ state: s, actions }: { state: ServerLessonState; actions: ServerLessonActions }) {
  if (s.phase === 'finished') return <Finished state={s} onDone={actions.markProjectDone} />;
  if (s.ayat.length) {
    return (
      <Card>
        {s.surahName && (
          <span className="text-center font-heading text-[18px] font-bold text-deep-green">
            سورة {s.surahName}
          </span>
        )}
        <div className="flex min-h-0 grow flex-col gap-[10px] overflow-y-auto">
          {s.ayat.map((a) => (
            <div
              key={a.ayah}
              className={cx(
                'rounded-px-18 px-[10px] py-[6px]',
                s.currentAyah === a.ayah ? 'bg-gold-tint' : 'bg-transparent',
              )}
            >
              <AyahText text={a.text} className="text-[24px] leading-[2]" bracketClassName="text-[20px]" />
              <span className="block text-center text-[14px] font-bold text-text-muted">
                الآية {toArabicDigits(a.ayah)}
              </span>
            </div>
          ))}
        </div>
      </Card>
    );
  }
  if (s.hadith) {
    return (
      <Card className="items-center justify-center gap-[12px] text-center">
        {s.hadith.title && <span className="font-heading text-[22px] font-bold">{s.hadith.title}</span>}
        <span className="font-classical text-[20px] leading-[2] text-text-muted">{HADITH_PLACEHOLDER}</span>
        {s.hadith.source && <span className="text-[15px] font-bold text-text-muted">{s.hadith.source}</span>}
        {s.words.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-[6px] p-0 text-start">
            {s.words.map((w) => (
              <li key={w.word} className="text-[16px]">
                <b>{w.word}</b>: {w.meaning}
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  }
  return null;
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'flex min-h-0 grow flex-col rounded-px-28 border-[1.5px] border-border bg-surface px-[16px] py-[14px] shadow-lesson-ayah-card',
        className,
      )}
    >
      {children}
    </div>
  );
}

function Finished({ state: s, onDone }: { state: ServerLessonState; onDone: (id: number) => void }) {
  return (
    <Card className="gap-[12px]">
      <span className="text-center font-heading text-[24px] font-bold text-deep-green">
        أكملت درس اليوم ✓
      </span>
      {s.projects.length > 0 && (
        <>
          <span className="text-[16px] font-extrabold text-text-muted">مشاريعي</span>
          <ul className="m-0 flex min-h-0 list-none flex-col gap-[8px] overflow-y-auto p-0">
            {s.projects.map((p) => (
              <li
                key={p.hadithId}
                className="flex items-center gap-[10px] rounded-px-18 bg-background px-[12px] py-[10px]"
              >
                <span className="flex min-w-0 grow flex-col">
                  <span className="text-[16px] font-extrabold">{p.title}</span>
                  <span className="text-[15px] leading-[1.6] text-text-muted">{p.action}</span>
                </span>
                {p.done ? (
                  <span className="shrink-0 text-[15px] font-extrabold text-deep-green">مكتمل ✓</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onDone(p.hadithId)}
                    className="h-[48px] shrink-0 cursor-pointer rounded-px-14 border-0 bg-deep-green px-[14px] text-[16px] font-extrabold text-surface"
                  >
                    أنجزته
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

const primaryBtn =
  'flex h-[56px] w-full cursor-pointer items-center justify-center rounded-px-22 border-0 bg-deep-green font-heading text-[20px] font-bold text-surface disabled:opacity-60';
const chipBtn =
  'min-h-[48px] cursor-pointer rounded-px-18 border-[1.5px] border-input-border bg-surface px-[16px] text-[16px] font-extrabold text-text-dark disabled:opacity-60';

function Bottom({ state: s, actions }: { state: ServerLessonState; actions: ServerLessonActions }) {
  if (s.phase === 'finished') {
    return (
      <button type="button" onClick={actions.goHome} className={primaryBtn}>
        عودة للرئيسية
      </button>
    );
  }
  if (s.phase === 'segmentDone') {
    return (
      <button type="button" onClick={actions.continueTapped} className={primaryBtn}>
        {s.nextSegment ? NEXT_LABEL[s.nextSegment] : 'أكمل'}
      </button>
    );
  }
  if (s.paused) return null;
  if (s.busy || !s.expects) {
    const label = s.reciting ? 'القارئ يقرأ… استمع' : s.speaking ? 'المعلّم يتكلم…' : 'لحظة…';
    return (
      <div role="status" aria-live="polite" className="flex h-[56px] shrink-0 items-center justify-center">
        <span className="text-[17px] font-extrabold text-text-muted">{label}</span>
      </div>
    );
  }
  if (s.expects === 'repeat') {
    return (
      <div className="flex shrink-0 items-center justify-center gap-[14px]" role="status" aria-live="polite">
        <span className="text-[17px] font-extrabold text-warning-text">
          {s.repeat === 'sending'
            ? 'المعلّم يسمع تلاوتك…'
            : s.micDenied
              ? 'ردّد ثم اضغط'
              : 'دورك… ردّد وأنا أسمعك'}
        </span>
        <button
          type="button"
          onClick={actions.repeatTapped}
          disabled={s.repeat === 'sending'}
          className="h-[48px] shrink-0 cursor-pointer rounded-px-14 border-0 bg-deep-green px-[18px] text-[17px] font-extrabold text-surface disabled:opacity-60"
        >
          ردّدت
        </button>
      </div>
    );
  }
  return <Answer state={s} actions={actions} />;
}

function Answer({ state: s, actions }: { state: ServerLessonState; actions: ServerLessonActions }) {
  const [text, setText] = useState('');
  const choice = s.expects === 'choice';
  const submit = () => {
    if (!text.trim()) return;
    actions.answer(text);
    setText('');
  };
  return (
    <div className="flex shrink-0 flex-col gap-[10px]">
      {s.expects === 'continue' && (
        <button type="button" onClick={actions.continueTapped} className={primaryBtn}>
          أكمل
        </button>
      )}
      {s.quickReplies.length > 0 && (
        <div className={cx('flex flex-wrap gap-[8px]', choice && 'flex-col')}>
          {s.quickReplies.map((q) => (
            <button key={q} type="button" onClick={() => actions.answer(q)} className={chipBtn}>
              {q}
            </button>
          ))}
        </div>
      )}
      {!choice && (
        <form
          className="flex items-center gap-[8px]"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            dir="rtl"
            aria-label={s.expects === 'continue' ? 'اسأل المعلّم' : 'اكتب جوابك'}
            placeholder={s.expects === 'continue' ? 'عندك سؤال؟ اكتبه هنا' : 'اكتب جوابك هنا'}
            className="h-[52px] min-w-0 grow rounded-px-20 border-[1.5px] border-input-border bg-surface px-[16px] text-[16px] text-text-dark placeholder:text-placeholder"
          />
          {s.canSpeak && (
            <button
              type="button"
              onClick={actions.speakAnswer}
              disabled={s.hearing}
              aria-label="قل جوابك"
              className={cx(
                'flex h-[52px] w-[52px] shrink-0 cursor-pointer items-center justify-center rounded-full border-0',
                s.hearing ? 'bg-gold' : 'bg-green-tint',
              )}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M5.5 11.5 C5.5 15.1 8.4 18 12 18 C15.6 18 18.5 15.1 18.5 11.5 M12 18 V21.2"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
          <button
            type="submit"
            disabled={!text.trim()}
            className="h-[52px] shrink-0 cursor-pointer rounded-px-20 border-0 bg-deep-green px-[18px] text-[16px] font-extrabold text-surface disabled:opacity-60"
          >
            أرسل
          </button>
        </form>
      )}
    </div>
  );
}
