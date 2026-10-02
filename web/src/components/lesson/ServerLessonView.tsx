// The live lesson on the AI server (VITE_AI_AGENT=1) — the SAME live call as the
// built-in lesson (LessonView): header «● مباشر» + timer, the big teacher with
// the live caption (the line being said now — no history), the surah card, and
// the mic at the bottom. Voice first: the teacher speaks every line and the mic
// opens by itself afterwards (consent); without consent or speech recognition the
// quick replies are big buttons. The text field hides behind «اكتب» (expects=text).
// Rendered from the ServerLesson's state only.
import { useEffect, useState } from 'react';

import type { ServerLessonState } from '../../lesson/server/serverLesson';
import { cx } from '../../lib/cx';
import { TEACHER_TEXT, type TeacherGender } from '../child/teacherCharacter';
import type { MouthSource } from '../child/TeacherSprite';
import {
  CallFrame,
  Card,
  HadithPendingCard,
  LiveHeader,
  MicIndicator,
  PlayFallback,
  SurahCard,
  TeacherStage,
  type LevelSource,
} from './LessonView';

export interface ServerLessonActions {
  answer(text: string): void;
  continueTapped(): void;
  repeatTapped(): void;
  speakAnswer(): void;
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
} as const;

/** The browser's recognition gives no level — the bars just breathe while the mic is open. */
const STEADY_LEVEL: LevelSource = { value: 0.7, subscribe: () => () => {} };

export function ServerLessonView({
  state: s,
  actions,
  desktop,
  gender = 'boy',
  mouth,
}: {
  state: ServerLessonState;
  actions: ServerLessonActions;
  desktop: boolean;
  /** The child's stored gender → المعلم عبدالله / المعلمة سارة (also the server voice). */
  gender?: TeacherGender;
  /** The teacher's lip-sync. */
  mouth?: MouthSource;
}) {
  const elapsedMs = useElapsed();
  const starting = s.phase === 'starting' || s.phase === 'warming';
  const listening = s.repeat === 'listening' || s.hearing;
  // Only the teacher talks — nothing of what he says is written. The line appears as
  // text only when no voice could say it (server and browser both failed), so the
  // lesson never goes silent with nothing on screen. Status lines (warming, done) stay.
  const caption = starting
    ? s.phase === 'warming'
      ? TEACHER_TEXT[gender].readying
      : 'نبدأ الحصة…'
    : s.phase === 'finished'
      ? 'أكملت درس اليوم ✓'
      : s.voiceMissing
        ? s.caption
        : '';
  return (
    <CallFrame desktop={desktop}>
      <LiveHeader elapsedMs={elapsedMs} onEnd={actions.exit} />
      <TeacherStage
        gender={gender}
        desktop={desktop}
        pose={s.reciting || starting ? 'quiet' : listening ? 'listening' : 'speaking'}
        talking={s.speaking}
        happy={false}
        // a repeat accepted, a part or the lesson finished
        cheerKey={s.cheer}
        mouth={mouth}
      >
        {caption && (
          <p
            aria-live="polite"
            className={cx(
              'm-0 line-clamp-3 w-full text-center text-[18px] leading-[1.7] font-bold',
              s.phase === 'finished' ? 'text-deep-green' : 'text-text-dark',
            )}
          >
            {caption}
          </p>
        )}
      </TeacherStage>
      <Notices state={s} onPlay={actions.playTapped} gender={gender} />
      <div className="flex min-h-0 grow flex-col">
        <Middle state={s} actions={actions} />
      </div>
      {!starting && <Bottom state={s} actions={actions} gender={gender} />}
    </CallFrame>
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

/** The built-in lesson's gold note: rate limit, restart, save, mic, and the teacher's blocked voice. */
function Notices({
  state: s,
  onPlay,
  gender,
}: {
  state: ServerLessonState;
  onPlay: () => void;
  gender: TeacherGender;
}) {
  const text =
    s.notice === 'rateLimited'
      ? TEACHER_TEXT[gender].resting
      : s.notice === 'restarted'
        ? 'خلّنا نبدأ من جديد — نجومك محفوظة.'
        : s.saveFailed
          ? 'لم نتمكّن من حفظ تقدّمك — تحقّق من الاتصال'
          : s.micDenied
            ? 'لا أسمعك — اطلب من بابا أو ماما السماح للمتصفح باستخدام الميكروفون.'
            : null;
  // The reciter's blocked audio shows on the surah card; the teacher's here.
  const voiceBlocked = s.playbackBlocked && !s.reciting;
  if (!text && !voiceBlocked) return null;
  return (
    <div
      role="alert"
      className="flex shrink-0 items-center gap-[10px] rounded-px-18 bg-gold-tint px-[14px] py-[10px]"
    >
      {text && <span className="grow text-[16px] leading-[1.6] font-bold text-on-gold">{text}</span>}
      {voiceBlocked && (
        <button
          type="button"
          onClick={onPlay}
          className="h-[48px] shrink-0 cursor-pointer rounded-px-14 border-0 bg-deep-green px-[16px] text-[16px] font-extrabold text-surface"
        >
          {TEACHER_TEXT[gender].tapToHear}
        </button>
      )}
    </div>
  );
}

function Middle({ state: s, actions }: { state: ServerLessonState; actions: ServerLessonActions }) {
  if (s.phase === 'finished') return <Finished state={s} onDone={actions.markProjectDone} />;
  if (s.ayat.length && s.surahName) {
    return (
      <SurahCard
        surahName={s.surahName}
        ayat={s.ayat}
        currentAyah={s.currentAyah}
        reciting={s.reciting}
        playbackBlocked={s.playbackBlocked && s.reciting}
        label={`سورة ${s.surahName}`}
        onTap={() => {}}
        onPlay={actions.playTapped}
      />
    );
  }
  if (s.hadith) {
    // The server's hadith text is never shown until vetted — the built-in «قيد المراجعة» card.
    return (
      <>
        <HadithPendingCard topic={s.hadith.title ?? 'حديث اليوم'} />
        {s.words.length > 0 && <WordsTable words={s.words} />}
      </>
    );
  }
  if (s.playbackBlocked && s.reciting) {
    return (
      <Card className="items-center justify-center">
        <PlayFallback onTap={actions.playTapped} />
      </Card>
    );
  }
  return null;
}

/** show_words — the hadith's new words and their meanings (filled only once the hadith is approved). */
function WordsTable({ words }: { words: ServerLessonState['words'] }) {
  return (
    <Card className="mt-[10px] shrink-0 grow-0 gap-[6px]">
      <span className="text-[16px] font-extrabold text-text-muted">كلمات جديدة</span>
      <dl className="m-0 flex flex-col gap-[6px]">
        {words.map((w) => (
          <div key={w.word} className="flex gap-[8px] text-[16px] leading-[1.6]">
            <dt className="font-classical font-bold">{w.word}</dt>
            <dd className="m-0 text-text-muted">{w.meaning}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/** L10Done-style: done + «مشاريعي» from /agent/actions. TODO(design): the projects list. */
function Finished({ state: s, onDone }: { state: ServerLessonState; onDone: (id: number) => void }) {
  if (!s.projects.length) return null;
  return (
    <Card className="gap-[10px]">
      <span className="text-[16px] font-extrabold text-text-muted">مشاريعي</span>
      <ul className="m-0 flex min-h-0 list-none flex-col gap-[8px] overflow-y-auto p-0">
        {s.projects.map((p) => (
          <li
            key={p.hadithId}
            className="flex items-center gap-[10px] rounded-px-18 bg-background px-[12px] py-[10px]"
          >
            <span className="flex min-w-0 grow flex-col">
              <span className="text-[16px] font-extrabold">{p.title}</span>
              <span className="text-[16px] leading-[1.6] text-text-muted">{p.action}</span>
            </span>
            {p.done ? (
              <span className="shrink-0 text-[16px] font-extrabold text-deep-green">مكتمل ✓</span>
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
    </Card>
  );
}

const bigButton =
  'flex h-[56px] w-full cursor-pointer items-center justify-center gap-[10px] rounded-px-22 border-0 bg-deep-green font-heading text-[20px] font-bold text-surface shadow-lesson-home-button disabled:opacity-60';
const bigChoice =
  'flex min-h-[56px] w-full cursor-pointer items-center justify-center rounded-px-22 border-[1.5px] border-input-border bg-surface px-[16px] text-[18px] font-extrabold text-text-dark';
const chip =
  'min-h-[48px] cursor-pointer rounded-pill border-[1.5px] border-input-border bg-surface px-[16px] text-[16px] font-extrabold text-text-dark';
const repeatButton =
  'h-[48px] shrink-0 cursor-pointer rounded-px-14 border-0 bg-deep-green px-[18px] text-[17px] font-extrabold text-surface disabled:opacity-60';

function Bottom({
  state: s,
  actions,
  gender,
}: {
  state: ServerLessonState;
  actions: ServerLessonActions;
  gender: TeacherGender;
}) {
  if (s.phase === 'finished') {
    return (
      <div className="flex shrink-0 flex-col gap-[8px]">
        <span className="text-center text-[16px] font-bold text-text-muted">إلى اللقاء غدًا</span>
        <button type="button" onClick={actions.goHome} className={bigButton}>
          عودة للرئيسية
        </button>
      </div>
    );
  }
  if (s.phase === 'segmentDone') {
    return (
      <button type="button" onClick={actions.continueTapped} className={bigButton}>
        {s.nextSegment ? NEXT_LABEL[s.nextSegment] : 'أكمل'}
      </button>
    );
  }
  if (s.paused || s.busy || !s.expects) {
    const label = s.reciting ? 'القارئ يقرأ… استمع' : s.speaking ? TEACHER_TEXT[gender].talking : 'لحظة…';
    return <MicIndicator live={false} label={label} />;
  }
  if (s.expects === 'repeat') {
    const live = s.repeat === 'listening' && !s.micDenied;
    return (
      <MicIndicator
        live={live}
        level={STEADY_LEVEL}
        label={
          s.repeat === 'sending'
            ? TEACHER_TEXT[gender].hearing
            : live
              ? 'دورك… ردّد وأنا أسمعك'
              : 'ردّد ثم اضغط'
        }
        trailing={
          // TODO(design): «ردّدت» — the same fallback as the built-in lesson; never a dead end.
          <button
            type="button"
            onClick={actions.repeatTapped}
            disabled={s.repeat === 'sending'}
            className={repeatButton}
          >
            ردّدت
          </button>
        }
      />
    );
  }
  return <Answer key={`${s.stageIndex}-${s.caption}`} state={s} actions={actions} />;
}

/** The child's turn on text / continue / choice. */
function Answer({ state: s, actions }: { state: ServerLessonState; actions: ServerLessonActions }) {
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  // «أكمل» always leads on `continue` (a side question can still be said or typed).
  const replies =
    s.expects === 'continue' ? ['أكمل', ...s.quickReplies.filter((q) => q !== 'أكمل')] : s.quickReplies;
  const tap = (q: string) =>
    s.expects === 'continue' && q === 'أكمل' ? actions.continueTapped() : actions.answer(q);
  const canType = s.expects === 'text';
  const field = typing && (
    <form
      className="flex items-center gap-[8px]"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        actions.answer(text);
        setText('');
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        dir="rtl"
        autoFocus
        aria-label="اكتب جوابك"
        placeholder="اكتب جوابك هنا"
        className="h-[52px] min-w-0 grow rounded-px-20 border-[1.5px] border-input-border bg-surface px-[16px] text-[16px] text-text-dark placeholder:text-placeholder"
      />
      <button
        type="submit"
        disabled={!text.trim()}
        className="h-[52px] shrink-0 cursor-pointer rounded-px-20 border-0 bg-deep-green px-[18px] text-[16px] font-extrabold text-surface disabled:opacity-60"
      >
        أرسل
      </button>
    </form>
  );
  const typeButton = canType && !typing && (
    <button type="button" onClick={() => setTyping(true)} className={chip}>
      اكتب
    </button>
  );

  if (s.canSpeak) {
    // Voice first: the mic is the answer; the replies are small chips under it.
    return (
      <div className="flex shrink-0 flex-col gap-[10px]">
        <MicIndicator
          live={s.hearing}
          level={STEADY_LEVEL}
          label={s.hearing ? 'دورك… أنا أسمعك' : 'اضغط الميكروفون وتكلّم'}
          onMicTap={s.hearing ? undefined : actions.speakAnswer}
        />
        {(replies.length > 0 || typeButton) && (
          <div className="flex flex-wrap justify-center gap-[8px]">
            {replies.map((q) => (
              <button key={q} type="button" onClick={() => tap(q)} className={chip}>
                {q}
              </button>
            ))}
            {typeButton}
          </div>
        )}
        {field}
      </div>
    );
  }
  // No consent / no recognition: the replies are the answer, as big buttons.
  return (
    <div className="flex shrink-0 flex-col gap-[10px]">
      {replies.map((q, i) => (
        <button
          key={q}
          type="button"
          onClick={() => tap(q)}
          className={i === 0 && s.expects === 'continue' ? bigButton : bigChoice}
        >
          {q}
        </button>
      ))}
      {typeButton && <div className="flex justify-center">{typeButton}</div>}
      {field}
    </div>
  );
}
