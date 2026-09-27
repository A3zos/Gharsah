import { C } from '../ui/color';
import { AlertIcon } from '../ui/icons';
import { BackButton } from '../ui/BackButton';
import { HomeBar } from '../ui/HomeBar';
import { Button } from '../ui/Button';
import { Blob, MobilePage } from '../ui/Page';

/**
 * design/v3 SCodeExpired — the child's code was refused (wrong or past its 24 h).
 * Shown from the child tab («ما الحل؟» / «اطلب رمزًا جديدًا»). The server can't
 * say which (both are "not found"), so the copy is the design's expiry help.
 */
export function SCodeExpired({ cells, onBack }: { cells: string[]; onBack: () => void }) {
  return (
    <MobilePage
      decor={<Blob className="-bottom-[140px] -left-[110px] h-[330px] w-[330px] bg-berry/10" />}
      innerClassName="px-[20px] pt-[26px] pb-[28px]"
    >
      <div className="mx-auto flex w-full max-w-[520px] grow flex-col gap-[14px]">
        <HomeBar />
        <div className="flex shrink-0 items-center gap-[12px]">
          <BackButton onClick={onBack} />
          <h1 className="m-0 font-heading text-[21px] font-bold">دخول الطفل</h1>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-[12px] pt-[22px]">
          <span className="text-[14px] font-bold">رمز الربط</span>
          <div className="flex gap-[8px] [direction:ltr]" aria-label="الرمز المُدخل">
            {cells.map((d, i) => (
              <span
                key={i}
                className="flex h-[64px] w-[46px] items-center justify-center rounded-px-17 border-[2px] border-berry-cell-border bg-berry-cell-bg font-heading text-[26px] font-extrabold text-error-text"
              >
                {d}
              </span>
            ))}
          </div>
          <span role="alert" className="flex items-center gap-[7px] text-[13px] font-bold text-error-text">
            <AlertIcon />
            انتهت صلاحية هذا الرمز
          </span>
        </div>
        <div className="flex shrink-0 animate-[gh-pop-6_.5s_ease-out_both] flex-col items-center gap-[12px] rounded-px-26 border-[1.5px] border-gold-border bg-gold-tint px-[18px] py-[22px]">
          <span
            className="flex h-[74px] w-[74px] items-center justify-center rounded-full bg-surface"
            aria-hidden="true"
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke={C.ayahBracket} strokeWidth="2" />
              <path
                d="M12 7 V12.4 L15.4 14.4"
                stroke={C.ayahBracket}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p className="m-0 text-center font-heading text-[24px] leading-[1.5] font-bold text-warning-text">
            الرمز انتهت مدّته
          </p>
          <p className="m-0 max-w-[290px] text-center text-[14.5px] leading-[1.95] text-text-muted">
            رموز الربط تنتهي بعد ٢٤ ساعة لحماية حسابك. اطلب من وليّ أمرك رمزًا جديدًا من شاشة «رمز الربط».
          </p>
        </div>
        <div className="mt-auto flex shrink-0 flex-col gap-[10px]">
          <Button
            size="custom"
            onClick={onBack}
            className="h-[64px] gap-[10px] rounded-px-22 font-heading text-[20px] font-bold shadow-lesson-home-button"
          >
            أدخل رمزًا آخر
          </Button>
          <span className="text-center text-[12.5px] font-bold text-text-muted">
            وليّ الأمر: التطبيق ← أبنائي ← رمز الربط ← إصدار رمز جديد
          </span>
        </div>
      </div>
    </MobilePage>
  );
}
