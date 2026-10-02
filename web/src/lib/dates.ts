// Dates as the design shows them: Hijri (Umm al-Qura), Arabic-Indic digits.

const hijri = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-arab', { timeZone: 'Asia/Riyadh', ...opts });

/** «٢٤ رمضان ١٤٤٧» */
export function hijriDate(d: Date): string {
  const parts = hijri({ day: 'numeric', month: 'long', year: 'numeric' }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('day')} ${get('month')} ${get('year')}`;
}

/** «١٤ رجب» */
export function hijriDayMonth(d: Date): string {
  const parts = hijri({ day: 'numeric', month: 'long' }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('day')} ${get('month')}`;
}

/** Whole hours until `d` («الرمز ينتهي بعد ٢٣ ساعة»). */
export const hoursUntil = (d: Date, now = new Date()) =>
  Math.max(0, Math.ceil((d.getTime() - now.getTime()) / 3_600_000));

/** A date from the server: an ISO string (Postgres JSON), a Date, or a legacy `{ toDate() }`. */
export function toDateOrNull(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (typeof v === 'string') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function')
    return (v as { toDate: () => Date }).toDate();
  return null;
}

const riyadhYmd = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Riyadh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The calendar day in Riyadh, «2026-10-02» — the pilot's one-lesson-a-day clock. */
export const riyadhDay = (d: Date): string => riyadhYmd.format(d);
