import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';

import type { ChildProfile } from '../../data/children';
import type { LeaderBoard } from '../../data/student';
import { STORAGE_KEY } from '../../i18n/i18n';
import { I18nProvider } from '../../i18n/I18nProvider';
import ChildHome from './home';
import ChildProfileRoute from './profile';
import WeeklyReviewRoute from './weekly-review';

const child: ChildProfile = {
  id: 'c1',
  name: 'بدر سعد',
  age: 10,
  gender: 'boy',
  avatarId: 'boy-1',
  pairing: null,
  linked: true,
  createdAt: null,
  stats: { streak: 3, surahs: 2, ayat: 9, hadith: 1, projects: 4, planPct: 0, stage: 'seed' },
  leader: null,
  aiVoiceConsent: false,
  pilotDaysDone: 0,
  pilotDoneAt: {},
  pilotUnscored: [],
  notRepeatedRefs: [],
  schedule: {
    days: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'],
    time: 17 * 60,
    custom: {},
    duration: 45,
    reminder: true,
    reviewDays: ['thu'],
  },
};

const board: LeaderBoard = {
  weekKey: '2026-09-26',
  total: 22,
  top: [
    { rank: 1, points: 30, me: false },
    { rank: 2, points: 29, me: false },
    { rank: 3, points: 28, me: false },
    { rank: 4, points: 27, me: false },
    { rank: 5, points: 26, me: false },
  ],
  me: { rank: 12, points: 14, gapToAbove: 2, inTop5: false },
};

vi.mock('../../components/child/ChildData', () => ({
  useChildData: () => ({ child, progress: new Map(), board, session: {} }),
}));
vi.mock('../../lesson/server/api', () => ({ agentEnabled: () => false, warmAgent: () => {} }));
vi.mock('../../lesson/web/serverVoice', () => ({ serverVoiceEnabled: () => false, warmAiSpeak: vi.fn() }));
vi.mock('../../components/child/teacherCharacter', () => ({ preloadTeacher: vi.fn() }));
vi.mock('../../lesson/web/audioUnlock', () => ({ unlockLessonAudio: vi.fn() }));

function renderPage(Page: () => React.ReactNode = ChildHome) {
  const Stub = createRoutesStub([
    {
      path: '/child/home',
      Component: () => (
        <I18nProvider>
          <Page />
        </I18nProvider>
      ),
    },
  ]);
  return render(<Stub initialEntries={['/child/home']} />);
}
const renderHome = () => renderPage();

afterEach(() => {
  localStorage.clear();
  document.documentElement.lang = 'ar';
  document.documentElement.dir = 'rtl';
});

test('Arabic (default): the home as before, rtl, Arabic-Indic digits', async () => {
  renderHome();
  expect(await screen.findByRole('heading', { name: 'مرحبًا بدر' })).toBeInTheDocument();
  expect(screen.getByText('مرحلتك: بذرة')).toBeInTheDocument();
  expect(screen.getByText('٣ أيام متتالية')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'حصة اليوم' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'ابدأ الحصة' })).toBeInTheDocument();
  expect(screen.getByText('سورتان')).toBeInTheDocument();
  expect(screen.getByText('٤ منجزة')).toBeInTheDocument();
  expect(screen.getByText('مراجعة هذا الأسبوع — الخميس')).toBeInTheDocument();
  expect(screen.getByText('باقي لك ٣ نجوم وتسبق المركز ١١')).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'تطبيق الطفل' })).toHaveTextContent('الرئيسية');
  expect(document.documentElement).toHaveAttribute('dir', 'rtl');
});

test('English: home copy, leaderboard, ltr, Latin digits', async () => {
  localStorage.setItem(STORAGE_KEY, 'en');
  renderHome();
  expect(await screen.findByRole('heading', { name: 'Hi بدر' })).toBeInTheDocument();
  expect(screen.getByText('Your stage: Seed')).toBeInTheDocument();
  expect(screen.getByText('3-day streak')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: "Today's lesson" })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Start the lesson' })).toBeInTheDocument();
  expect(screen.getByText('Surah Al-Ikhlas')).toBeInTheDocument();
  expect(screen.getByText('2 surahs')).toBeInTheDocument();
  expect(screen.getByText('4 done')).toBeInTheDocument();
  expect(screen.getByText("This week's review — Thursday")).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: "This week's leaderboard" })).toBeInTheDocument();
  expect(screen.getByText('Just 3 stars more to pass place 11')).toBeInTheDocument();
  expect(screen.getByText('بدر — you')).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Child app' })).toHaveTextContent('Home');
  expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  expect(document.documentElement).toHaveAttribute('lang', 'en');
  expect(document.body.textContent).not.toMatch(/[٠-٩]/);
});

test('Indonesian: home copy, ltr, Latin digits', async () => {
  localStorage.setItem(STORAGE_KEY, 'id');
  renderHome();
  expect(await screen.findByRole('heading', { name: 'Halo بدر' })).toBeInTheDocument();
  expect(screen.getByText('Tahapmu: Benih')).toBeInTheDocument();
  expect(screen.getByText('3 hari berturut-turut')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Pelajaran hari ini' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Mulai pelajaran' })).toBeInTheDocument();
  expect(screen.getByText('Murajaah pekan ini — Kamis')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Papan peringkat pekan ini' })).toBeInTheDocument();
  expect(screen.getByText('Tinggal 3 bintang lagi untuk menyalip peringkat 11')).toBeInTheDocument();
  expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  expect(document.body.textContent).not.toMatch(/[٠-٩]/);
});

test('profile and weekly review in English; Arabic unchanged', async () => {
  localStorage.setItem(STORAGE_KEY, 'en');
  const profile = renderPage(ChildProfileRoute);
  expect(await screen.findByRole('heading', { name: 'My profile' })).toBeInTheDocument();
  expect(screen.getByText('10 years old')).toBeInTheDocument();
  expect(screen.getByText("34% more of your plan and you'll be a Sapling!")).toBeInTheDocument();
  expect(screen.getByRole('link', { name: "I'm the parent" })).toBeInTheDocument();
  profile.unmount();

  const weekly = renderPage(WeeklyReviewRoute);
  expect(await screen.findByRole('heading', { name: 'Review', level: 1 })).toBeInTheDocument();
  expect(screen.getByText(/ — at 5:00\sPM$/)).toBeInTheDocument();
  expect(screen.getByText('The button turns on Thursday morning')).toBeInTheDocument();
  weekly.unmount();

  localStorage.clear();
  renderPage(WeeklyReviewRoute);
  expect(await screen.findByRole('heading', { name: 'المراجعة', level: 1 })).toBeInTheDocument();
  expect(screen.getByText(/ — الساعة ٥:٠٠ مساءً$/)).toBeInTheDocument();
  expect(screen.getByText('يتفعّل الزر صباح الخميس')).toBeInTheDocument();
});
