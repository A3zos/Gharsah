// /admin — aggregate statistics only (public.admin_stats()). Pure view: the route
// loads, this renders loading / «غير مصرّح» / error / the dashboard.
import type { AdminLoad, AdminStats, DailyPoint } from '../../data/admin';
import { fill, formatNumber, useI18n, type UiLanguage } from '../../i18n/i18n';
import { cx } from '../../lib/cx';

/** Numbers / percentages in the UI language (Arabic-Indic digits in Arabic). */
function useFormat() {
  const { lang, m } = useI18n();
  const t = m.admin;
  const n = (v: number) => formatNumber(lang, Math.round(v * 10) / 10);
  const pct = (v: number) => fill(lang, t.pct, { n: Math.round(v * 10) / 10 });
  return { lang, t, n, pct };
}

const time = (lang: UiLanguage, d: Date) =>
  d.toLocaleTimeString(lang === 'ar' ? 'ar-SA-u-nu-arab' : lang, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Riyadh',
  });

export function AdminView({ state, onRefresh }: { state: AdminLoad; onRefresh: () => void }) {
  const { lang, t } = useFormat();
  if (state.kind === 'forbidden') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-[16px] text-text-dark">
        <h1 className="m-0 font-heading text-[28px] font-bold">{t.forbidden}</h1>
      </main>
    );
  }
  return (
    <main className="min-h-dvh bg-background px-[16px] py-[24px] text-text-dark md:px-[32px]">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[20px]">
        <header className="flex flex-wrap items-center justify-between gap-[12px]">
          <h1 className="m-0 font-heading text-[28px] leading-[1.4] font-bold">{t.title}</h1>
          <div className="flex items-center gap-[12px]">
            {state.kind === 'ok' && (
              <span className="text-[14px] text-text-muted">
                {t.updated.replace('{time}', time(lang, state.loadedAt))}
              </span>
            )}
            <button
              type="button"
              onClick={onRefresh}
              disabled={state.kind === 'loading'}
              className="h-[44px] cursor-pointer rounded-px-14 border-0 bg-deep-green px-[18px] text-[15px] font-extrabold text-surface disabled:opacity-60"
            >
              {t.refresh}
            </button>
          </div>
        </header>
        {state.kind === 'loading' && (
          <p aria-busy="true" className="m-0 text-text-muted">
            {t.loading}
          </p>
        )}
        {state.kind === 'error' && (
          <p
            role="alert"
            className="m-0 rounded-px-18 bg-gold-tint px-[16px] py-[12px] font-bold text-on-gold"
          >
            {t.error}
          </p>
        )}
        {state.kind === 'ok' && <Dashboard s={state.stats} />}
      </div>
    </main>
  );
}

function Dashboard({ s }: { s: AdminStats }) {
  const { lang, t, n, pct } = useFormat();
  const f = (text: string, vars: Record<string, number>) => fill(lang, text, vars);
  return (
    <>
      <section aria-label={t.kpis} className="grid grid-cols-2 gap-[12px] md:grid-cols-3 xl:grid-cols-6">
        <Kpi label={t.parents} value={n(s.parents.total)} sub={f(t.in7, { n: s.parents.last7 })} />
        <Kpi label={t.children} value={n(s.children.total)} />
        <Kpi label={t.paired} value={n(s.pairedDevices)} />
        <Kpi label={t.activeSubs} value={n(s.subscriptions.active)} />
        <Kpi
          label={t.lessonsDone}
          value={n(s.lessons.completed)}
          sub={f(t.ofStarted, { n: s.lessons.started })}
        />
        <Kpi label={t.completion} value={pct(s.lessons.completionRate)} accent />
      </section>

      <section aria-label={t.last30} className="grid gap-[12px] md:grid-cols-2">
        <Chart title={t.chartParents} days={s.daily} pick={(d) => d.newParents} color="bg-primary" />
        <Chart title={t.chartLessons} days={s.daily} pick={(d) => d.lessonsCompleted} color="bg-gold" />
      </section>

      <section className="grid gap-[12px] md:grid-cols-2 xl:grid-cols-3">
        <Table
          title={t.lessons}
          head={[t.headLesson, t.headStarted, t.headCompleted, t.headRate]}
          rows={s.lessons.byLesson.map((l) => [l.title, n(l.started), n(l.completed), pct(l.rate)])}
        />
        <Table
          title={t.plans}
          head={[t.headPlan, t.headCount]}
          rows={[
            [t.annual, n(s.subscriptions.annual)],
            [t.monthly, n(s.subscriptions.monthly)],
            [t.trial, n(s.subscriptions.trial)],
            [t.none, n(s.subscriptions.none)],
          ]}
        />
        <Table
          title={t.byAge}
          head={[t.headAge, t.headCount]}
          rows={[
            [t.age89, n(s.children.byAge['8-9'])],
            [t.age1011, n(s.children.byAge['10-11'])],
            [t.age1213, n(s.children.byAge['12-13'])],
            [t.boysGirls, `${n(s.children.byGender.boy)} / ${n(s.children.byGender.girl)}`],
          ]}
        />
      </section>

      <section aria-label={t.details} className="grid grid-cols-2 gap-[12px] md:grid-cols-4">
        <Kpi label={t.ayat} value={n(s.memorization.ayat)} />
        <Kpi label={t.surahs} value={n(s.memorization.surahs)} />
        <Kpi label={t.hadith} value={n(s.memorization.hadith)} />
        <Kpi
          label={t.reports}
          value={pct(s.projects.reportRate)}
          sub={f(t.ofN, { a: s.projects.reported, b: s.projects.assigned })}
        />
        <Kpi label={t.activeToday} value={n(s.engagement.activeToday)} />
        <Kpi label={t.active7} value={n(s.engagement.active7)} />
        <Kpi label={t.perChild} value={n(s.engagement.lessonsPerActiveChild)} />
        <Kpi label={t.newToday} value={n(s.parents.today)} sub={f(t.in30, { n: s.parents.last30 })} />
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

/** Simple bar chart (no library): one bar per day, oldest → today from left to right. */
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
  const { lang, t, n } = useFormat();
  const max = Math.max(1, ...days.map(pick));
  const total = days.reduce((t, d) => t + pick(d), 0);
  return (
    <figure className="m-0 flex flex-col gap-[10px] rounded-px-24 bg-surface px-[16px] py-[14px] shadow-card">
      <figcaption className="flex items-baseline justify-between gap-[8px]">
        <span className="text-[16px] font-extrabold">{title}</span>
        <span className="text-[14px] text-text-muted">{fill(lang, t.total, { n: total })}</span>
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
        <span>{formatNumber(lang, days[0]?.day.slice(5) ?? '')}</span>
        <span>{formatNumber(lang, days.at(-1)?.day.slice(5) ?? '')}</span>
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
              <th key={h} className="border-b border-b-border py-[6px] text-start font-bold text-text-muted">
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
