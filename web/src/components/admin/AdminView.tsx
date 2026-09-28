// /admin — aggregate statistics only (public.admin_stats()). Pure view: the route
// loads, this renders loading / «غير مصرّح» / error / the dashboard.
import type { AdminLoad, AdminStats, DailyPoint } from '../../data/admin';
import { toArabicDigits } from '../../lib/arabicDigits';
import { cx } from '../../lib/cx';

const n = (v: number) => toArabicDigits(Math.round(v * 10) / 10);
const pct = (v: number) => `${toArabicDigits(Math.round(v * 10) / 10)}٪`;
const time = (d: Date) =>
  d.toLocaleTimeString('ar-SA-u-nu-arab', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Riyadh' });

export function AdminView({ state, onRefresh }: { state: AdminLoad; onRefresh: () => void }) {
  if (state.kind === 'forbidden') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-[16px] text-text-dark">
        <h1 className="m-0 font-heading text-[28px] font-bold">غير مصرّح</h1>
      </main>
    );
  }
  return (
    <main className="min-h-dvh bg-background px-[16px] py-[24px] text-text-dark md:px-[32px]">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[20px]">
        <header className="flex flex-wrap items-center justify-between gap-[12px]">
          <h1 className="m-0 font-heading text-[28px] leading-[1.4] font-bold">إحصاءات غَرْسة</h1>
          <div className="flex items-center gap-[12px]">
            {state.kind === 'ok' && (
              <span className="text-[14px] text-text-muted">آخر تحديث: {time(state.loadedAt)}</span>
            )}
            <button
              type="button"
              onClick={onRefresh}
              disabled={state.kind === 'loading'}
              className="h-[44px] cursor-pointer rounded-px-14 border-0 bg-deep-green px-[18px] text-[15px] font-extrabold text-surface disabled:opacity-60"
            >
              تحديث
            </button>
          </div>
        </header>
        {state.kind === 'loading' && (
          <p aria-busy="true" className="m-0 text-text-muted">
            جارٍ التحميل…
          </p>
        )}
        {state.kind === 'error' && (
          <p
            role="alert"
            className="m-0 rounded-px-18 bg-gold-tint px-[16px] py-[12px] font-bold text-on-gold"
          >
            تعذّر تحميل الإحصاءات — حاول مرة أخرى.
          </p>
        )}
        {state.kind === 'ok' && <Dashboard s={state.stats} />}
      </div>
    </main>
  );
}

function Dashboard({ s }: { s: AdminStats }) {
  return (
    <>
      <section aria-label="المؤشرات" className="grid grid-cols-2 gap-[12px] md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="أولياء الأمور" value={n(s.parents.total)} sub={`+${n(s.parents.last7)} خلال ٧ أيام`} />
        <Kpi label="الأطفال" value={n(s.children.total)} />
        <Kpi label="الأجهزة المربوطة" value={n(s.pairedDevices)} />
        <Kpi label="الاشتراكات الفعّالة" value={n(s.subscriptions.active)} />
        <Kpi label="الحصص المكتملة" value={n(s.lessons.completed)} sub={`من ${n(s.lessons.started)} بدأت`} />
        <Kpi label="نسبة الإكمال" value={pct(s.lessons.completionRate)} accent />
      </section>

      <section aria-label="آخر ٣٠ يومًا" className="grid gap-[12px] md:grid-cols-2">
        <Chart
          title="أولياء أمور جدد — آخر ٣٠ يومًا"
          days={s.daily}
          pick={(d) => d.newParents}
          color="bg-primary"
        />
        <Chart
          title="حصص مكتملة — آخر ٣٠ يومًا"
          days={s.daily}
          pick={(d) => d.lessonsCompleted}
          color="bg-gold"
        />
      </section>

      <section className="grid gap-[12px] md:grid-cols-2 xl:grid-cols-3">
        <Table
          title="الحصص"
          head={['الحصة', 'بدأت', 'اكتملت', 'النسبة']}
          rows={s.lessons.byLesson.map((l) => [l.title, n(l.started), n(l.completed), pct(l.rate)])}
        />
        <Table
          title="الباقات"
          head={['الباقة', 'العدد']}
          rows={[
            ['سنوية', n(s.subscriptions.annual)],
            ['شهرية', n(s.subscriptions.monthly)],
            ['تجريبية', n(s.subscriptions.trial)],
            ['بلا اشتراك', n(s.subscriptions.none)],
          ]}
        />
        <Table
          title="الأطفال حسب العمر"
          head={['العمر', 'العدد']}
          rows={[
            ['٨–٩', n(s.children.byAge['8-9'])],
            ['١٠–١١', n(s.children.byAge['10-11'])],
            ['١٢–١٣', n(s.children.byAge['12-13'])],
            ['أولاد / بنات', `${n(s.children.byGender.boy)} / ${n(s.children.byGender.girl)}`],
          ]}
        />
      </section>

      <section aria-label="تفاصيل" className="grid grid-cols-2 gap-[12px] md:grid-cols-4">
        <Kpi label="آيات محفوظة" value={n(s.memorization.ayat)} />
        <Kpi label="سور مكتملة" value={n(s.memorization.surahs)} />
        <Kpi label="أحاديث" value={n(s.memorization.hadith)} />
        <Kpi
          label="تقارير المشاريع"
          value={pct(s.projects.reportRate)}
          sub={`${n(s.projects.reported)} من ${n(s.projects.assigned)}`}
        />
        <Kpi label="نشطون اليوم" value={n(s.engagement.activeToday)} />
        <Kpi label="نشطون خلال ٧ أيام" value={n(s.engagement.active7)} />
        <Kpi label="حصص لكل طفل نشط" value={n(s.engagement.lessonsPerActiveChild)} />
        <Kpi
          label="أولياء أمور جدد اليوم"
          value={n(s.parents.today)}
          sub={`${n(s.parents.last30)} خلال ٣٠ يومًا`}
        />
      </section>
    </>
  );
}

function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-[4px] rounded-px-24 bg-surface px-[16px] py-[14px] shadow-card">
      <span className="text-[14px] font-bold text-text-muted">{label}</span>
      <span
        className={cx(
          'font-heading text-[30px] leading-[1.2] font-extrabold',
          accent ? 'text-warning-text' : 'text-deep-green',
        )}
      >
        {value}
      </span>
      {sub && <span className="text-[13px] text-text-muted">{sub}</span>}
    </div>
  );
}

/** Simple bar chart (no library): one bar per day, right = today (RTL). */
function Chart({
  title,
  days,
  pick,
  color,
}: {
  title: string;
  days: DailyPoint[];
  pick: (d: DailyPoint) => number;
  color: string;
}) {
  const max = Math.max(1, ...days.map(pick));
  const total = days.reduce((t, d) => t + pick(d), 0);
  return (
    <figure className="m-0 flex flex-col gap-[10px] rounded-px-24 bg-surface px-[16px] py-[14px] shadow-card">
      <figcaption className="flex items-baseline justify-between gap-[8px]">
        <span className="text-[16px] font-extrabold">{title}</span>
        <span className="text-[14px] text-text-muted">المجموع: {n(total)}</span>
      </figcaption>
      <div
        className="flex h-[140px] items-end gap-[2px] [direction:ltr]"
        role="img"
        aria-label={`${title}: ${n(total)}`}
      >
        {days.map((d) => (
          <span
            key={d.day}
            title={`${d.day}: ${pick(d)}`}
            className={cx('min-w-0 grow basis-0 rounded-t-px-6', pick(d) ? color : 'bg-border-soft')}
            style={{ height: `${Math.max(3, (pick(d) / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[12px] text-text-muted [direction:ltr]">
        <span>{toArabicDigits(days[0]?.day.slice(5) ?? '')}</span>
        <span>{toArabicDigits(days.at(-1)?.day.slice(5) ?? '')}</span>
      </div>
    </figure>
  );
}

function Table({ title, head, rows }: { title: string; head: string[]; rows: string[][] }) {
  return (
    <div className="flex flex-col gap-[8px] overflow-x-auto rounded-px-24 bg-surface px-[16px] py-[14px] shadow-card">
      <h2 className="m-0 text-[16px] font-extrabold">{title}</h2>
      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="border-b border-b-border py-[6px] text-right font-bold text-text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]}>
              {r.map((c, i) => (
                <td key={i} className={cx('border-b border-b-border-soft py-[6px]', i > 0 && 'font-bold')}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
