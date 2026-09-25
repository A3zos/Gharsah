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
