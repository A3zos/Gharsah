// design/v3 Dashboard growth card (phone): the stage illustration, the plan bar
// and the seed → sprout → tree timeline that draws itself in.
import type { Stage } from '../../data/stats';
import { toArabicDigits } from '../../lib/arabicDigits';
import { C } from '../ui/color';
import { Blob } from '../ui/Page';

const ORDER: Stage[] = ['seed', 'sprout', 'tree'];
const LABEL: Record<Stage, string> = { seed: 'بذرة', sprout: 'غَرْسة', tree: 'شجرة' };

function Illustration({ stage }: { stage: Stage }) {
  return (
    <svg width="186" height="152" viewBox="0 0 160 150" fill="none" aria-hidden="true">
      <circle cx="80" cy="68" r="62" fill={C.greenTint} />
      {stage === 'seed' && (
        <g>
          <ellipse cx="80" cy="100" rx="11" ry="15" fill={C.gold} />
          <path d="M80 88 C86 93 86 105 80 110 C74 105 74 93 80 88 Z" fill={C.seedGold} />
          <circle cx="56" cy="84" r="3" fill={C.seedDots} />
          <circle cx="106" cy="78" r="3.6" fill={C.seedDots} />
        </g>
      )}
      {stage === 'sprout' && (
        <g>
          <path d="M80 114 V52" stroke={C.deepGreen} strokeWidth="5.5" strokeLinecap="round" />
          <path d="M80 96 C64 96 54 88 54 74 C70 74 80 82 80 96 Z" fill={C.primary} />
          <path d="M80 88 C96 88 106 80 106 66 C90 66 80 74 80 88 Z" fill={C.softGreen} />
          <path d="M80 74 C68 74 60 67 60 56 C73 56 80 63 80 74 Z" fill={C.softGreen} />
          <circle cx="80" cy="46" r="10" fill={C.primary} />
          <circle cx="108" cy="44" r="3.4" fill={C.gold} />
        </g>
      )}
      {stage === 'tree' && (
        <g>
          <path d="M80 116 V64" stroke={C.deepGreen} strokeWidth="7" strokeLinecap="round" />
          <path
            d="M80 88 L62 76 M80 80 L98 68"
            stroke={C.deepGreen}
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <circle cx="80" cy="44" r="25" fill={C.primary} />
          <circle cx="55" cy="58" r="17" fill={C.softGreen} />
          <circle cx="105" cy="58" r="17" fill={C.softGreen} />
          <circle cx="66" cy="36" r="5" fill={C.gold} />
          <circle cx="94" cy="50" r="5" fill={C.gold} />
          <circle cx="88" cy="28" r="4.4" fill={C.gold} />
          <circle cx="52" cy="66" r="4.4" fill={C.gold} />
        </g>
      )}
      <path d="M26 116 C52 107 108 107 134 116 L134 126 C108 117 52 117 26 126 Z" fill={C.borderStrong} />
    </svg>
  );
}

function StageIcon({ stage, on }: { stage: Stage; on: boolean }) {
  if (stage === 'seed') {
    return (
      <svg width="26" height="26" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <ellipse cx="20" cy="20" rx="9" ry="13" fill={C.gold} />
        <path d="M20 9 C25 14 25 26 20 31 C15 26 15 14 20 9 Z" fill={C.seedGold} />
      </svg>
    );
  }
  const stem = on ? C.deepGreen : C.stageOffStem;
  const c1 = on ? C.primary : C.stageOffLeaf;
  const c2 = on ? C.softGreen : C.stageOffLeafLight;
  if (stage === 'sprout') {
    return (
      <svg width="36" height="36" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path d="M20 33 V17" stroke={stem} strokeWidth="3.2" strokeLinecap="round" />
        <path d="M20 25 C12 25 7 20 7 13 C15 13 20 18 20 25 Z" fill={c1} />
        <path d="M20 21 C28 21 33 16 33 9 C25 9 20 14 20 21 Z" fill={c2} />
      </svg>
    );
  }
  const gold = on ? C.gold : C.borderStrong;
  return (
    <svg width="44" height="44" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M20 35 V21" stroke={stem} strokeWidth="3.6" strokeLinecap="round" />
      <circle cx="20" cy="13" r="9.5" fill={c1} />
      <circle cx="10.5" cy="19.5" r="6.5" fill={c2} />
      <circle cx="29.5" cy="19.5" r="6.5" fill={c2} />
      <circle cx="15" cy="9" r="2.6" fill={gold} />
      <circle cx="27" cy="16" r="2.4" fill={gold} />
    </svg>
  );
}

export function GrowthHero({
  name,
  stage,
  pct,
  planChip,
}: {
  name: string;
  stage: Stage;
  pct: number;
  planChip: string;
}) {
  const at = ORDER.indexOf(stage);
  const seg = (from: number, span: number) =>
    `${Math.round(Math.min(1, Math.max(0, (pct - from) / span)) * 1000) / 10}%`;
  const delays = [0.08, 0.62, 1.14];
  return (
    <section
      aria-label={`نموّ ${name}`}
      className="relative flex flex-col gap-[14px] overflow-hidden rounded-px-28 bg-surface p-[20px] shadow-card"
    >
      <Blob className="-top-[80px] -left-[70px] h-[230px] w-[230px] bg-blob-green-faint" />
      <Blob className="-right-[50px] -bottom-[60px] h-[160px] w-[160px] bg-blob-gold-faint" />
      <div className="relative flex items-center justify-between gap-[10px]">
        <h2 className="m-0 font-heading text-[22px] leading-[1.5] font-bold">{name}</h2>
        <span className="rounded-pill bg-border-soft px-[12px] py-[7px] text-[12px] font-bold whitespace-nowrap text-text-dark">
          {planChip}
        </span>
      </div>
      <div className="relative flex items-center justify-center">
        <Illustration stage={stage} />
      </div>
      <div className="relative flex flex-col gap-[8px]">
        <div className="flex items-baseline justify-between gap-[10px]">
          <span className="text-[13px] font-bold text-text-muted">
            المرحلة الحالية: <span className="text-deep-green">{LABEL[stage]}</span>
          </span>
          <span className="font-heading text-[19px] leading-[1.3] font-extrabold text-deep-green">
            {toArabicDigits(pct)}٪
          </span>
        </div>
        <div
          className="h-[10px] overflow-hidden rounded-px-6 bg-border-soft"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="من الباقة التجريبية"
        >
          <div className="h-full rounded-px-6 bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[11.5px] text-text-muted">من الباقة التجريبية</span>
      </div>
      <div className="relative flex items-start px-[2px] pt-[6px] [direction:ltr]" aria-hidden="true">
        {ORDER.map((s, i) => (
          <div key={s} className="contents">
            {i > 0 && (
              <div className="relative mt-[32px] h-0 grow border-t-[2.5px] border-dotted border-t-border-strong">
                <div
                  className="absolute -top-[2.5px] left-0 h-[2.5px] origin-left rounded-px-2 bg-primary"
                  style={{
                    width: i === 1 ? seg(0, 34) : seg(34, 33),
                    animation: `gh-line .5s ease-out ${i === 1 ? '.2s' : '.74s'} both`,
                  }}
                />
              </div>
            )}
            <div className="flex w-[66px] shrink-0 flex-col items-center gap-[8px]">
              <span
                className="flex h-[66px] w-[66px] items-center justify-center rounded-full"
                style={{
                  background: i === 0 ? C.goldTint : i <= at ? C.greenTint : C.borderSoft,
                  border: i === at ? `2.5px solid ${C.primary}` : 0,
                  animation: `gh-pop .45s ease-out ${delays[i]}s both${i === at ? `, gh-pulse 2.6s ease-in-out ${delays[i]! + 0.6}s infinite` : ''}`,
                }}
              >
                <StageIcon stage={s} on={i <= at} />
              </span>
              <span
                className="text-[12.5px] font-extrabold"
                style={{ color: i <= at ? C.deepGreen : C.textFaint }}
              >
                {LABEL[s]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
