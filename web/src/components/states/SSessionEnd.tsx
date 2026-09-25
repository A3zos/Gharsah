import { C } from '../ui/color';
import { SproutMark } from '../ui/icons';
import { buttonClass } from '../ui/Button';
import { Blob, MobilePage } from '../ui/Page';

/**
 * design/v2 SSessionEnd — «انتهت الجلسة» (web parent signed out after a long
 * idle) or «حدث خطأ غير متوقّع» (kind="error", with the problem code).
 */
export function SSessionEnd({
  kind = 'ended',
  onPrimary,
  onHome,
  errorCode = 'GH-٥٠٣',
}: {
  kind?: 'ended' | 'error';
  onPrimary: () => void;
  onHome: () => void;
  errorCode?: string;
}) {
  const ended = kind === 'ended';
  return (
    <MobilePage
      decor={<Blob className="-bottom-[140px] -left-[110px] h-[330px] w-[330px] bg-blob-green-10" />}
      innerClassName="px-[20px] pt-[26px] pb-[28px]"
    >
      <div className="mx-auto flex w-full max-w-[520px] grow flex-col gap-[14px]">
        <div className="flex shrink-0 items-center gap-[12px]">
          <span className="flex items-center gap-[10px]">
            <SproutMark size={30} seed={false} />
            <span className="font-heading text-[22px] font-bold text-deep-green">غَرْسة</span>
          </span>
        </div>
        <div className="flex grow flex-col items-center justify-center gap-[20px]" role="status">
          <span
            className={`flex h-[118px] w-[118px] animate-[gh-pop-6_.5s_ease-out_both] items-center justify-center rounded-full ${ended ? 'bg-green-tint' : 'bg-berry-tint'}`}
            aria-hidden="true"
          >
            {ended ? (
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
                <rect x="5" y="10.5" width="14" height="9.5" rx="3" stroke={C.deepGreen} strokeWidth="2" />
                <path
                  d="M8.5 10.5 V8 C8.5 6 10 4.5 12 4.5 C14 4.5 15.5 6 15.5 8 V10.5"
                  stroke={C.deepGreen}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9.2" stroke={C.berryDeep} strokeWidth="2" />
                <path d="M12 7.2 V13" stroke={C.berryDeep} strokeWidth="2.3" strokeLinecap="round" />
                <circle cx="12" cy="16.5" r="1.5" fill={C.berryDeep} />
              </svg>
            )}
          </span>
          <h1 className="m-0 text-center font-heading text-[28px] leading-[1.5] font-bold text-text-dark">
            {ended ? 'انتهت الجلسة' : 'حدث خطأ غير متوقّع'}
          </h1>
          <p className="m-0 max-w-[300px] text-center text-[15.5px] leading-[1.95] text-text-muted">
            {ended
              ? 'سجّلنا خروجك للحفاظ على حسابك. ادخل مرة أخرى وتكمل من حيث وقفت.'
              : 'لم نستطع إتمام العملية. حاول مرة أخرى — وإن تكرّر الأمر أرسل لنا رمز المشكلة.'}
          </p>
          {!ended && (
            <span className="rounded-pill bg-border-soft px-[16px] py-[8px] text-[12.5px] font-bold text-text-muted">
              رمز المشكلة: {errorCode}
            </span>
          )}
        </div>
        <div className="mt-auto flex shrink-0 flex-col gap-[10px]">
          <button
            type="button"
            onClick={onPrimary}
            className={buttonClass(
              'primary',
              'custom',
              'h-[64px] gap-[10px] rounded-px-22 border-0 font-heading text-[20px] font-bold shadow-lesson-home-button',
            )}
          >
            {ended ? 'سجّل الدخول مرة أخرى' : 'أعد المحاولة'}
          </button>
          <button
            type="button"
            onClick={onHome}
            className={buttonClass(
              'quiet',
              'custom',
              'h-[56px] gap-[9px] rounded-px-20 text-[15px] font-bold',
            )}
          >
            العودة للبداية
          </button>
        </div>
      </div>
    </MobilePage>
  );
}
