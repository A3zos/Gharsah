// The live lesson on the AI server (VITE_AI_AGENT=1) as a pure VOICE call — the same
// call as the built-in lesson (LessonView): header «● مباشر» + timer, the big
// teacher (who only talks — nothing written), the surah / hadith card, and the mic.
// The child answers by voice: the mic opens by itself after every line. No reply
// buttons, no text field. The only button during the call: the «سماح» prompt when
// the mic (or the sound) needs a tap; «عودة للرئيسية» once the lesson is over.
// Rendered from the ServerLesson's state only.
import { ayahTranslation } from '../../content/translations';
import { TranslationNote } from './Translation';
import { useEffect, useState } from 'react';

import { fill, useI18n } from '../../i18n/i18n';
import type { ServerLessonState } from '../../lesson/server/serverLesson';
import { hadithLabelIn, surahNameIn } from '../../lesson/teacherLines';
import { cx } from '../../lib/cx';
import { type TeacherGender } from '../child/teacherCharacter';
import type { MouthSource } from '../child/TeacherSprite';
import {
  CallFrame,
  Card,
  HadithPendingCard,
  LiveHeader,
  SurahCard,
  TeacherStage,
  type LevelSource,
} from './LessonView';
import { AllowPrompt, VoiceMic } from './VoiceCall';

export interface ServerLessonActions {
  /** «سماح» — the mic (or the sound) prompt. */
  allowTapped(): void;
  exit(): void;
  goHome(): void;
}

/** Speech recognition gives no level — the bars just breathe while the mic is open. */
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
  const { m } = useI18n();
  const elapsedMs = useElapsed();
  const starting = s.phase === 'starting' || s.phase === 'warming';
  const listening = s.repeat === 'listening' || s.hearing;
  // Only the teacher talks — nothing of what he says is written; the line appears as
  // text only when no voice could say it. Status lines (getting ready, done) stay.
  const caption = starting
    ? m.lesson.teacher[gender].readying
    : s.phase === 'finished'
      ? m.lesson.end.done
      : s.voiceMissing
        ? s.caption
        : '';
  const prompt = s.micPrompt ? 'mic' : s.playbackBlocked ? 'sound' : null;
  // The reciter or the child is on the ayat: the card gets the room, the teacher a small avatar.
  const onAyat = s.ayat.length > 0 && (s.reciting || s.expects === 'repeat' || s.repeat !== 'idle');
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
        compact={onAyat}
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
      {s.saveFailed && (
        <div role="alert" className="shrink-0 rounded-px-18 bg-gold-tint px-[14px] py-[10px]">
          <span className="text-[16px] leading-[1.6] font-bold text-on-gold">
            {m.lesson.problems.saveFailed}
          </span>
        </div>
      )}
      <div className="flex min-h-0 grow flex-col">
        <Middle state={s} onAyat={onAyat} />
      </div>
      {!starting && <Bottom state={s} actions={actions} gender={gender} />}
      {prompt && <AllowPrompt reason={prompt} gender={gender} onAllow={actions.allowTapped} />}
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

/** The ayah card (verified text) or the hadith card — the child reads along. */
function Middle({ state: s, onAyat }: { state: ServerLessonState; onAyat: boolean }) {
  const { lang, m } = useI18n();
  if (s.phase === 'finished') return null;
  if (s.ayat.length && s.surahName) {
    // shrinks away when the recitation ends (the teacher grows back at the same time)
    return (
      <div
        aria-hidden={!onAyat}
        className={cx(
          'flex min-h-0 origin-top flex-col transition-[flex-grow,opacity,transform] duration-500 ease-out motion-reduce:transition-none',
          onAyat ? 'grow opacity-100' : 'pointer-events-none grow-0 scale-95 opacity-0',
        )}
      >
        <SurahCard
          surahName={s.surahName}
          ayat={s.ayat}
          currentAyah={s.currentAyah}
          reciting={s.reciting}
          playbackBlocked={false}
          label={fill(lang, m.lesson.surah, { name: surahNameIn(lang, s.surahName) })}
          bannerLabel={
            lang === 'ar' ? undefined : fill(lang, m.lesson.surah, { name: surahNameIn(lang, s.surahName) })
          }
          onTap={() => {}}
          onPlay={() => {}}
        />
        {s.surahNo !== null && s.currentAyah !== null && (
          <TranslationNote t={ayahTranslation(lang, s.surahNo, s.currentAyah)} />
        )}
      </div>
    );
  }
  if (s.hadith) {
    // The server's hadith text is never shown until vetted — the built-in «قيد المراجعة» card.
    return (
      <>
        <HadithPendingCard
          topic={s.hadith.title ? hadithLabelIn(lang, s.hadith.title) : m.lesson.hadith.today}
        />
        {s.words.length > 0 && <WordsTable words={s.words} />}
      </>
    );
  }
  return null;
}

/** show_words — the hadith's new words and their meanings (filled only once the hadith is approved). */
function WordsTable({ words }: { words: ServerLessonState['words'] }) {
  const { m } = useI18n();
  return (
    <Card className="mt-[10px] shrink-0 grow-0 gap-[6px]">
      <span className="text-[16px] font-extrabold text-text-muted">{m.lesson.hadith.newWords}</span>
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

function Bottom({
  state: s,
  actions,
  gender,
}: {
  state: ServerLessonState;
  actions: ServerLessonActions;
  gender: TeacherGender;
}) {
  const { m } = useI18n();
  if (s.phase === 'finished') {
    return (
      <button
        type="button"
        onClick={actions.goHome}
        className="flex h-[56px] w-full shrink-0 cursor-pointer items-center justify-center gap-[10px] rounded-px-22 border-0 bg-deep-green font-heading text-[20px] font-bold text-surface shadow-lesson-home-button"
      >
        {m.lesson.end.home}
      </button>
    );
  }
  const live = !s.paused && !s.listenOnly && (s.hearing || s.repeat === 'listening');
  const label = live
    ? m.lesson.mic.yourTurn
    : s.reciting
      ? m.lesson.mic.reciter
      : s.speaking
        ? m.lesson.teacher[gender].talking
        : m.lesson.mic.moment;
  return <VoiceMic live={live} heardKey={s.heard} level={STEADY_LEVEL} label={label} />;
}
