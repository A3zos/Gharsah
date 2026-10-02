import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';

import { paths } from '../../app/paths';
import { ChildAvatar } from '../../components/child/ChildAvatar';
import { AVATARS, defaultAvatar } from '../../content/avatars';
import { useParentData } from '../../components/parent/ParentData';
import { DesktopHeader, ParentPage } from '../../components/parent/ParentShell';
import { BackButton } from '../../components/ui/BackButton';
import { HomeBar } from '../../components/ui/HomeBar';
import { LeaveGuard } from '../../components/ui/LeaveGuard';
import { Button, buttonClass } from '../../components/ui/Button';
import { C } from '../../components/ui/color';
import { AlertIcon, ForwardIcon } from '../../components/ui/icons';
import { Note } from '../../components/ui/Note';
import {
  ChoiceChips,
  ClockGlyph,
  DayPicker,
  daysCountText,
  DurationChips,
  ReviewDayPicker,
  ReviewGlyph,
  TimeStepper,
} from '../../components/ui/SchedulePickers';
import { Stepper, StepperWide } from '../../components/ui/Stepper';
import {
  addChild,
  DEFAULT_SCHEDULE,
  formatTime,
  updateSchedule,
  WEEK_DAYS,
  type ChildProfile,
  type ChildSchedule,
  type Gender,
  type WeekDay,
  MAX_REVIEW_DAYS,
} from '../../data/children';
import { maxChildren } from '../../content/plans';
import { isSubscribed } from '../../data/parent';
import { toArabicDigits } from '../../lib/arabicDigits';
import { cx } from '../../lib/cx';
import { DESKTOP, useMedia } from '../../lib/useMedia';
import type { Route } from './+types/children-new';

export const meta: Route.MetaFunction = () => [{ title: 'إضافة ابن — غَرْسة' }];

const STEPS = ['البيانات', 'الجدول', 'الشخصية'];
/** Each step is a URL (`?step=`) so the browser back button walks the steps. */
const STEP_KEYS = ['data', 'schedule', 'avatar'] as const;
/** Where the flow was opened from — «رجوع» on the first step goes back there. */
const ORIGINS: Record<string, string> = {
  children: paths.parent.children,
  plans: paths.parent.plans,
  dashboard: paths.parent.dashboard(),
};
const AGES = [8, 9, 10, 11, 12, 13] as const;

interface Draft {
  name: string;
  age: number;
  gender: Gender;
  schedule: ChildSchedule;
  avatarId: string;
}

/**
 * design/v3 AddChild → Schedule (→ ScheduleCustom) → AvatarPicker on phones,
 * ParentWebAddChild on desktop. `?child=<id>` edits an existing child's
 * schedule only («تعديل الجدول» in أبنائي). `?from=children|plans|dashboard`
 * is where «رجوع» on the first step returns.
 */
export default function AddChildRoute() {
  const [params] = useSearchParams();
  const editId = params.get('child');
  const { children, subscription } = useParentData();
  const editing = editId ? (children?.find((c) => c.id === editId) ?? null) : null;
  if (children === null || subscription === undefined) {
    return <ParentPage tab={null} desktop={<div aria-busy="true" />} />;
  }
  if (editId && !editing) return <ParentPage tab={null} desktop={<NotFound />} />;
  // design/v3 PackagesLimit: the monthly plan covers one child (UI-only for now,
  // see TODO(child-limit) in firestore.rules).
  // The plan's children limit (monthly 1, the pilot 3) → PackagesLimit instead of a refused save.
  const lim = subscription && isSubscribed(subscription) ? maxChildren(subscription.plan) : null;
  if (!editId && lim !== null && children.length >= lim) {
    return <Navigate to={`${paths.parent.plans}?limit=1`} replace />;
  }
  return <Flow key={editId ?? 'new'} editing={editing} />;
}

function NotFound() {
  return (
    <p className="m-0 text-[15px] text-text-muted">
      لم نجد بيانات هذا الابن. <Link to={paths.parent.children}>العودة إلى أبنائي</Link>
    </p>
  );
}

function Flow({ editing }: { editing: ChildProfile | null }) {
  const navigate = useNavigate();
  const desktop = useMedia(DESKTOP);
  const [params, setParams] = useSearchParams();
  const origin = ORIGINS[params.get('from') ?? ''] ?? paths.parent.children;
  const keyIndex = STEP_KEYS.indexOf((params.get('step') ?? 'data') as (typeof STEP_KEYS)[number]);
  const step = editing ? 1 : Math.min(STEPS.length - 1, Math.max(0, keyIndex));
  const setStep = (n: number) => {
    const next = new URLSearchParams(params);
    next.set('step', STEP_KEYS[n]!);
    setParams(next);
  };
  const [custom, setCustom] = useState(() => Object.keys(editing?.schedule?.custom ?? {}).length > 0);
  const [draft, setDraft] = useState<Draft>(() => ({
    name: editing?.name ?? '',
    age: editing?.age ?? 10,
    gender: editing?.gender ?? 'girl',
    schedule: editing?.schedule ?? DEFAULT_SCHEDULE,
    avatarId: editing?.avatarId ?? defaultAvatar(editing?.gender ?? 'girl'),
  }));
  const steps = STEPS;
  const lastStep = steps.length - 1;
  const [initial] = useState(() => JSON.stringify(draft));
  const dirty = JSON.stringify(draft) !== initial;
  const [nameError, setNameError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const setSchedule = (p: Partial<ChildSchedule>) => set({ schedule: { ...draft.schedule, ...p } });
  const toggleDay = (d: WeekDay) => {
    const off = draft.schedule.days.includes(d);
    const days = off ? draft.schedule.days.filter((x) => x !== d) : [...draft.schedule.days, d];
    // A day that stops being a lesson day stops being a review day too.
    setSchedule({ days, reviewDays: draft.schedule.reviewDays.filter((x) => days.includes(x)) });
  };
  // «الجنس» preselects avatar 1 of that gender; an avatar sets the gender (boy-N → ولد, girl-N → بنت).
  const pickGender = (g: Gender) => set({ gender: g, avatarId: defaultAvatar(g) });
  const pickAvatar = (avatarId: string) =>
    set({ avatarId, gender: AVATARS.find((a) => a.key === avatarId)?.gender ?? draft.gender });

  const exit = () => navigate(origin);
  // Review days: 1–3 of the lesson days (the database enforces the same rule).
  const [reviewLimit, setReviewLimit] = useState(false);
  const toggleReview = (d: WeekDay) => {
    const cur = draft.schedule.reviewDays;
    if (!draft.schedule.days.includes(d)) return;
    if (cur.includes(d)) {
      setReviewLimit(false);
      setSchedule({ reviewDays: cur.filter((x) => x !== d) });
    } else if (cur.length >= MAX_REVIEW_DAYS) {
      setReviewLimit(true);
    } else {
      setReviewLimit(false);
      setSchedule({ reviewDays: [...cur, d] });
    }
  };

  const next = async () => {
    setError(null);
    if (step === 0) {
      const n = draft.name.trim();
      if (!n || n.length > 40) return setNameError(true);
      return setStep(1);
    }
    if (step === 1) {
      if (!draft.schedule.days.length) return setError('اختر يومًا واحدًا على الأقل.');
      if (!draft.schedule.reviewDays.some((d) => draft.schedule.days.includes(d)))
        return setError('اختر يوم مراجعة واحدًا على الأقل من أيام الحصص.');
      if (!custom) setSchedule({ custom: {} });
      if (!editing) return setStep(2);
    }
    if (!editing && step < lastStep) return setStep(step + 1);
    if (busy) return;
    setBusy(true);
    const schedule = custom ? draft.schedule : { ...draft.schedule, custom: {} };
    try {
      if (editing) {
        await updateSchedule(editing.id, schedule);
        navigate(paths.parent.children, { replace: true });
      } else {
        const { id } = await addChild({ ...draft, schedule });
        navigate(paths.parent.childCode(id), { replace: true, state: { fresh: true } });
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const ctaLabel = editing
    ? 'حفظ الجدول'
    : step === 0
      ? desktop
        ? 'التالي — الجدول'
        : 'التالي — جدول التعلّم'
      : step === 1
        ? desktop
          ? 'التالي — الشخصية'
          : 'التالي — اختيار الشخصية'
        : 'حفظ وإنشاء رمز الربط';

  // A deep link to a later step of a new child starts at the first step.
  if (!editing && step > 0 && !draft.name.trim()) {
    const first = new URLSearchParams(params);
    first.set('step', 'data');
    return <Navigate to={`?${first}`} replace />;
  }

  // Leaving with unsaved input asks first; moving between the steps doesn't.
  const guard = <LeaveGuard when={dirty && !busy} allow={(n, c) => n.pathname === c.pathname} />;

  const errorLine = error && (
    <p role="alert" className="m-0 flex items-center gap-[7px] text-[13px] font-bold text-error-text">
      <AlertIcon />
      {error}
    </p>
  );

  // ── Desktop: ParentWebAddChild ──
  if (desktop) {
    const dim = (s: number) => (editing ? s !== 1 : s !== step) && 'pointer-events-none opacity-[0.55]';
    return (
      <ParentPage
        tab="children"
        desktop={
          <div className="flex grow flex-col gap-[24px]">
            {guard}
            <DesktopHeader
              title={editing ? `جدول ${editing.name}` : 'إضافة ابن'}
              subtitle={
                editing
                  ? 'عدّل أيام الحصص ووقتها ومدّتها.'
                  : 'ثلاث خطوات: بياناته، جدوله، ثم شخصيته — وينتهي برمز الربط.'
              }
            />
            {!editing && <StepperWide steps={steps} current={step} />}
            <div className="flex min-h-0 grow gap-[20px]">
              <section
                aria-label="بيانات الابن"
                aria-disabled={step !== 0 || undefined}
                className={cx(
                  'flex grow basis-0 flex-col gap-[20px] rounded-px-30 bg-surface px-[32px] py-[30px] shadow-dark-14-30-5',
                  dim(0),
                )}
              >
                <h2 className="m-0 font-heading text-[23px] font-bold">بيانات الابن</h2>
                <NameField
                  value={draft.name}
                  error={nameError}
                  onChange={(v) => (set({ name: v }), setNameError(false))}
                  wide
                />
                <AgeField value={draft.age} onChange={(age) => set({ age })} wide />
                <GenderField value={draft.gender} onChange={pickGender} />
                <div className="flex items-start gap-[12px] rounded-px-20 bg-sky-tint px-[18px] py-[16px]">
                  <svg
                    className="shrink-0"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="9.5" stroke={C.skyText} strokeWidth="1.8" />
                    <path d="M12 11 V16.5" stroke={C.skyText} strokeWidth="2" strokeLinecap="round" />
                    <circle cx="12" cy="7.8" r="1.3" fill={C.skyText} />
                  </svg>
                  <span className="text-[13.5px] leading-[1.9] text-sky-text">
                    لا نطلب أي بيانات من الابن نفسه — الاسم والعمر لك وحدك، ويستخدمهما المعلّم لمناداته.
                  </span>
                </div>
              </section>
              <div className="flex grow basis-0 flex-col gap-[20px]">
                <section
                  aria-label="جدول التعلّم"
                  className={cx(
                    'flex flex-col gap-[18px] rounded-px-30 bg-surface px-[32px] py-[30px] shadow-dark-14-30-5',
                    dim(1),
                  )}
                >
                  <h2 className="m-0 font-heading text-[23px] font-bold">جدول التعلّم</h2>
                  <span className="text-[14px] text-text-muted">أيام الحصص</span>
                  <DayPicker
                    days={draft.schedule.days}
                    onToggle={toggleDay}
                    reviewDays={draft.schedule.reviewDays}
                    wide
                  />
                  <ReviewDaySection draft={draft} onToggle={toggleReview} limit={reviewLimit} />
                  <div className="flex flex-col gap-[8px]">
                    <span className="text-[14px] text-text-muted">وقت الحصة</span>
                    <TimeStepper minutes={draft.schedule.time} onChange={(time) => setSchedule({ time })} />
                  </div>
                  <div className="flex flex-col gap-[8px]">
                    <span className="text-[14px] text-text-muted">مدّة الجلسة</span>
                    <DurationChips
                      value={draft.schedule.duration}
                      onChange={(duration) => setSchedule({ duration })}
                    />
                  </div>
                  <CustomTimes draft={draft} open={custom} onOpen={setCustom} setSchedule={setSchedule} />
                </section>
                {!editing && (
                  <section
                    aria-label="شخصية الابن"
                    className={cx(
                      'flex grow flex-col gap-[18px] rounded-px-30 bg-surface px-[32px] py-[30px] shadow-dark-14-30-5',
                      dim(2),
                    )}
                  >
                    <h2 className="m-0 font-heading text-[23px] font-bold">شخصية الابن</h2>
                    <AvatarGrid value={draft.avatarId} onChange={pickAvatar} compact />
                  </section>
                )}
              </div>
            </div>
            {errorLine}
            <div className="flex items-center gap-[14px]">
              <button
                type="button"
                onClick={() => (step > 0 && !editing ? setStep(step - 1) : exit())}
                className={buttonClass(
                  'quiet',
                  'custom',
                  'h-[62px] rounded-px-22 px-[28px] text-[16px] font-bold',
                )}
              >
                {step > 0 && !editing ? 'السابق' : 'إلغاء'}
              </button>
              <span className="grow" />
              <Button
                size="custom"
                onClick={() => void next()}
                disabled={busy}
                aria-busy={busy}
                className="h-[62px] gap-[10px] rounded-px-22 px-[40px] font-heading text-[19px] font-bold shadow-lesson-home-button"
              >
                {ctaLabel}
                <ForwardIcon size={22} />
              </Button>
            </div>
          </div>
        }
      />
    );
  }

  // ── Phones: AddChild / Schedule / ScheduleCustom / AvatarPicker ──
  const back = () =>
    step === 0 || editing ? exit() : window.history.length > 1 ? navigate(-1) : setStep(step - 1);
  const title = editing
    ? `جدول ${editing.name}`
    : step === 0
      ? 'إضافة ابن'
      : step === 1
        ? 'جدول التعلّم'
        : `اختر شخصية ${draft.name.trim()}`;
  return (
    <ParentPage
      tab={null}
      mobileDecor={false}
      desktop={
        <div className="mx-auto flex w-full max-w-[430px] grow flex-col gap-[18px] pt-[4px]">
          {guard}
          <HomeBar />
          <div className="flex items-center gap-[12px]">
            <BackButton
              onClick={back}
              label={step === 0 || editing ? 'رجوع' : `رجوع إلى ${steps[step - 1]}`}
            />
            <h1 className="m-0 font-heading text-[24px] leading-[1.5] font-bold">{title}</h1>
          </div>
          {!editing && <Stepper steps={steps} current={step} />}

          {step === 0 && (
            <>
              <NameField
                value={draft.name}
                error={nameError}
                onChange={(v) => (set({ name: v }), setNameError(false))}
              />
              <AgeField value={draft.age} onChange={(age) => set({ age })} />
              <GenderField value={draft.gender} onChange={pickGender} />
              <Note tone="green" icon={<InfoGreen />}>
                يمكنك تعديل العمر لاحقًا من لوحة التحكم.
              </Note>
            </>
          )}

          {step === 1 && (
            <>
              <p className="m-0 text-[13.5px] leading-[1.8] text-text-muted">
                حدّد أيام الحصص ووقتها — ونذكّر طفلك تلقائيًا.
              </p>
              <div className="flex flex-col gap-[11px]">
                <div className="flex items-baseline justify-between gap-[10px]">
                  <span className="text-[14px] font-bold">أيام الحصص</span>
                  <span className="text-[12.5px] text-text-muted">
                    {daysCountText(draft.schedule.days.length)}
                  </span>
                </div>
                <DayPicker
                  days={draft.schedule.days}
                  onToggle={toggleDay}
                  reviewDays={draft.schedule.reviewDays}
                />
              </div>
              {/* design/v3: the picker is on Schedule; ScheduleCustom (custom open) shows the gold note instead. */}
              {!custom && <ReviewDaySection draft={draft} onToggle={toggleReview} limit={reviewLimit} />}
              <div className="flex flex-col gap-[10px]">
                <div className="flex items-baseline justify-between gap-[10px]">
                  <span className="text-[14px] font-bold">وقت الحصة</span>
                  <span className="text-[12.5px] text-text-muted">
                    {custom ? 'الوقت الافتراضي' : 'يُطبَّق على كل الأيام المختارة'}
                  </span>
                </div>
                <TimeStepper minutes={draft.schedule.time} onChange={(time) => setSchedule({ time })} />
                <CustomTimes draft={draft} open={custom} onOpen={setCustom} setSchedule={setSchedule} />
              </div>
              <div className="flex flex-col gap-[10px]">
                <span className="text-[14px] font-bold">الحدّ الأقصى للحصة اليومية</span>
                <DurationChips
                  value={draft.schedule.duration}
                  onChange={(duration) => setSchedule({ duration })}
                />
                {custom && draft.schedule.reviewDays.length > 0 && (
                  <p className="m-0 rounded-px-14 bg-gold-tint px-[13px] py-[11px] text-[12.5px] leading-[1.8] text-warning-text">
                    الأيام الذهبية هي أيام المراجعة الأسبوعية — تُعدّلها من شاشة الجدول.
                  </p>
                )}
                <p className="m-0 text-[12.5px] leading-[1.8] text-text-muted">
                  الحصة تنتهي متى أنهى طفلُك دروس اليوم، دون تجاوز هذه المدة.
                </p>
              </div>
              <div className="flex items-center gap-[9px]">
                <svg
                  className="shrink-0"
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M12 4 C9.2 4 7 6.2 7 9 V13 L5.4 15.8 H18.6 L17 13 V9 C17 6.2 14.8 4 12 4 Z"
                    stroke={C.textMuted}
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M10 18.2 C10.4 19.3 11.1 19.9 12 19.9 C12.9 19.9 13.6 19.3 14 18.2"
                    stroke={C.textMuted}
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="text-[12.5px] text-text-muted">سنذكّر طفلك قبل موعد الحصة</span>
              </div>
              <Note tone="green" icon={<InfoGreen />}>
                يمكنك تعديل الجدول لاحقًا من لوحة التحكم في أي وقت.
              </Note>
            </>
          )}

          {step === 2 && (
            <>
              <p className="m-0 text-[13.5px] leading-[1.8] text-text-muted">
                شخصيات محتشمة ولطيفة — يراها طفلك في تطبيقه مع كل إنجاز.
              </p>
              <AvatarGrid value={draft.avatarId} onChange={pickAvatar} />
              <div className="flex items-center gap-[12px] rounded-px-20 bg-surface px-[16px] py-[14px] shadow-child-card">
                <svg width="24" height="24" viewBox="0 0 76 76" fill="none" aria-hidden="true">
                  <path d="M38 60 V34" stroke={C.deepGreen} strokeWidth="6" strokeLinecap="round" />
                  <path d="M38 40 C28 40 22 34 22 26 C32 26 38 32 38 40 Z" fill={C.primary} />
                  <path d="M38 45 C48 45 54 39 54 31 C44 31 38 37 38 45 Z" fill={C.softGreen} />
                </svg>
                <p className="m-0 text-[12.5px] leading-[1.8] text-text-muted">
                  تنمو شجرة الشخصية كلما أتمّ طفلك حفظًا جديدًا.
                </p>
              </div>
            </>
          )}

          {errorLine}
          <Button className="mt-auto shrink-0" onClick={() => void next()} disabled={busy} aria-busy={busy}>
            {ctaLabel}
          </Button>
        </div>
      }
    />
  );
}

/** design/v3 Schedule «أيام المراجعة الأسبوعية» — 1 to 3 of the lesson days (review notes B5). */
function ReviewDaySection({
  draft,
  onToggle,
  limit,
}: {
  draft: Draft;
  onToggle: (d: WeekDay) => void;
  limit: boolean;
}) {
  const chosen = WEEK_DAYS.filter((d) => draft.schedule.reviewDays.includes(d.id));
  return (
    <div className="flex flex-col gap-[11px]">
      <div className="flex items-baseline justify-between gap-[10px]">
        <span className="flex items-center gap-[8px] text-[14px] font-bold">
          <ReviewGlyph />
          أيام المراجعة الأسبوعية
          <span className="text-[12px] font-bold text-text-muted">٣ أيام كحد أقصى</span>
        </span>
        <span className="text-[12.5px] font-bold text-warning-text" aria-live="polite">
          {chosen.length ? `مراجعة · ${chosen.map((d) => d.label).join('، ')}` : 'اختر يومًا'}
        </span>
      </div>
      <ReviewDayPicker
        value={draft.schedule.reviewDays}
        lessonDays={draft.schedule.days}
        onToggle={onToggle}
      />
      {limit && (
        <p role="alert" className="m-0 text-[12.5px] font-bold text-error-text">
          تقدر تختار ٣ أيام مراجعة كحد أقصى
        </p>
      )}
      <p className="m-0 text-[12.5px] leading-[1.8] text-text-muted">
        في أيام المراجعة تحلّ حصةُ المراجعة محلّ الدرس الجديد — يعيد طفلك ما حفظه من السور والأحاديث.
      </p>
    </div>
  );
}

function InfoGreen() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" stroke={C.deepGreen} strokeWidth="1.8" />
      <path d="M12 11 V16.5" stroke={C.deepGreen} strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="7.8" r="1.3" fill={C.deepGreen} />
    </svg>
  );
}

function NameField({
  value,
  onChange,
  error,
  wide,
}: {
  value: string;
  onChange: (v: string) => void;
  error: boolean;
  wide?: boolean;
}) {
  return (
    <div className={cx('flex flex-col', wide ? 'gap-[9px]' : 'gap-[8px]')}>
      <label htmlFor="child-name" className={cx('font-bold', wide ? 'text-[14.5px]' : 'text-[14px]')}>
        اسم الابن
      </label>
      <input
        id="child-name"
        name="child_name"
        type="text"
        autoComplete="off"
        maxLength={40}
        placeholder="الاسم كما يحبّ أن يُنادى"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error || undefined}
        aria-describedby={error ? 'child-name-msg' : undefined}
        className={cx(
          'h-[58px] w-full rounded-px-20 border-[1.5px] bg-surface px-[18px] font-body text-[16px] text-text-dark placeholder:text-placeholder',
          error ? 'border-berry' : 'border-input-border',
        )}
      />
      {error && (
        <span id="child-name-msg" className="text-[12.5px] font-medium text-error-text">
          اكتب اسم الابن (٤٠ حرفًا على الأكثر).
        </span>
      )}
    </div>
  );
}

function AgeField({
  value,
  onChange,
  wide,
}: {
  value: number;
  onChange: (v: number) => void;
  wide?: boolean;
}) {
  return (
    <div className="flex flex-col gap-[10px]">
      <div className="flex items-baseline justify-between">
        <span className={cx('font-bold', wide ? 'text-[14.5px]' : 'text-[14px]')}>العمر</span>
        <span className="text-[12.5px] text-text-muted">من ٨ إلى ١٣ سنة</span>
      </div>
      <div className="[&>div]:gap-[8px]">
        <ChoiceChips
          label="العمر"
          options={AGES}
          value={value as (typeof AGES)[number]}
          onChange={onChange}
          render={(n) => toArabicDigits(n)}
          ariaFor={(n) => `${toArabicDigits(n)} ${n <= 10 ? 'سنوات' : 'سنة'}`}
          className="h-[56px] rounded-px-18 font-heading text-[20px] font-bold"
        />
      </div>
    </div>
  );
}

function GenderField({ value, onChange }: { value: Gender; onChange: (g: Gender) => void }) {
  return (
    <div className="flex flex-col gap-[10px]">
      <span className="text-[14px] font-bold">الجنس</span>
      <div role="radiogroup" aria-label="الجنس" className="flex gap-[12px]">
        {(['girl', 'boy'] as const).map((g) => {
          const on = value === g;
          return (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(g)}
              className={cx(
                'flex h-[128px] grow flex-col items-center justify-center gap-[8px] rounded-px-24 font-body',
                on
                  ? 'border-[2px] border-deep-green bg-green-tint'
                  : 'border-[1.5px] border-border bg-surface',
              )}
            >
              <ChildAvatar id={defaultAvatar(g)} size={58} />
              <span className="text-[15px] font-bold text-text-dark">{g === 'girl' ? 'بنت' : 'ولد'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** «شخصية الابن»: all eight — a row of 4 boys, then a row of 4 girls. */
function AvatarGrid({
  value,
  onChange,
  compact,
}: {
  value: string;
  onChange: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="الشخصية" className="grid grid-cols-4 gap-[12px]">
      {AVATARS.map((a) => {
        const on = a.key === value;
        return (
          <button
            key={a.key}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={a.label}
            onClick={() => onChange(a.key)}
            className={cx(
              'relative flex items-center justify-center p-0',
              compact ? 'h-[110px] rounded-px-26' : 'h-[90px] rounded-px-24',
              on
                ? 'border-[2.5px] border-deep-green bg-green-tint'
                : 'border-[1.5px] border-border bg-surface',
            )}
          >
            {/* ~85% of the card's height, never wider than the card — head and shoulders whole */}
            <ChildAvatar
              id={a.key}
              size={compact ? 94 : 76}
              circle={false}
              fluid
              className="aspect-square h-[88%] max-w-[calc(100%-6px)]"
            />
            {on && (
              <span
                className="absolute top-[8px] left-[8px] flex h-[26px] w-[26px] items-center justify-center rounded-full bg-deep-green"
                aria-hidden="true"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 12.5 L10 17.5 L19 7"
                    stroke={C.surface}
                    strokeWidth="3.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** «تخصيص وقت لكل يوم» — collapsed (Schedule) / open (ScheduleCustom). */
function CustomTimes({
  draft,
  open,
  onOpen,
  setSchedule,
}: {
  draft: Draft;
  open: boolean;
  onOpen: (v: boolean) => void;
  setSchedule: (p: Partial<ChildSchedule>) => void;
}) {
  const { schedule } = draft;
  const chosen = WEEK_DAYS.filter((d) => schedule.days.includes(d.id));
  const bump = (d: WeekDay) => {
    const offset = ((schedule.custom[d] ?? schedule.time) - schedule.time + 1440) % 1440;
    const nextOffset = (offset + 15) % 120;
    const custom = { ...schedule.custom };
    if (nextOffset === 0) delete custom[d];
    else custom[d] = (schedule.time + nextOffset) % 1440;
    setSchedule({ custom });
  };
  const lines = (
    <svg className="shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7 H20 M4 12 H20 M4 17 H13" stroke={C.deepGreen} strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
  if (!open) {
    return (
      <button
        type="button"
        aria-expanded={false}
        onClick={() => onOpen(true)}
        className="flex h-[58px] items-center gap-[10px] rounded-px-18 border-[1.5px] border-border bg-transparent px-[16px] text-right font-body"
      >
        {lines}
        <span className="flex grow flex-col gap-[1px]">
          <span className="text-[14px] font-bold text-deep-green">تخصيص وقت لكل يوم</span>
          <span className="text-[11.5px] text-text-muted">اختياري — لأوقات مختلفة بين الأيام</span>
        </span>
        <svg className="shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 9.5 L12 15.5 L18 9.5"
            stroke={C.textMuted}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    );
  }
  return (
    <div>
      <button
        type="button"
        aria-expanded
        aria-controls="custom-times"
        onClick={() => onOpen(false)}
        className="flex h-[58px] w-full items-center gap-[10px] rounded-t-px-18 border-[1.5px] border-b-0 border-seed-dots bg-green-tint px-[16px] text-right font-body"
      >
        {lines}
        <span className="flex grow flex-col gap-[1px]">
          <span className="text-[14px] font-bold text-deep-green">تخصيص وقت لكل يوم</span>
          <span className="text-[11.5px] text-text-muted">مُفعّل — اضغط للإخفاء</span>
        </span>
        <svg className="shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 14.5 L12 8.5 L18 14.5"
            stroke={C.deepGreen}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        id="custom-times"
        className="flex flex-col gap-[8px] rounded-b-px-18 border-[1.5px] border-t-0 border-seed-dots bg-green-tint px-[14px] pt-[4px] pb-[16px]"
      >
        <p className="m-0 mb-[4px] text-[11.5px] leading-[1.8] text-text-muted">
          يُستخدم الوقت الافتراضي أعلاه لأي يوم لم تغيّره.
        </p>
        {chosen.map((d) => (
          <div
            key={d.id}
            className={cx(
              'flex items-center gap-[10px] rounded-px-16 border-[1.5px] px-[8px] py-[7px]',
              schedule.reviewDays.includes(d.id)
                ? 'border-gold-border bg-gold-tint'
                : 'border-surface bg-surface',
            )}
          >
            <span className="grow ps-[8px] text-[14px] font-bold">
              {d.label}
              {schedule.reviewDays.includes(d.id) && ' · مراجعة'}
            </span>
            <button
              type="button"
              onClick={() => bump(d.id)}
              aria-label={`تأخير وقت ${d.label} ربع ساعة`}
              className="flex h-[44px] shrink-0 items-center gap-[7px] rounded-px-14 border-[1.5px] border-seed-dots bg-background px-[14px] font-body text-[14.5px] font-bold text-deep-green"
            >
              <ClockGlyph size={17} />
              {formatTime(schedule.custom[d.id] ?? schedule.time)}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
