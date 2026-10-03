import { render, screen, within } from '@testing-library/react';

import type { LeaderBoard } from '../../data/student';
import { STORAGE_KEY } from '../../i18n/i18n';
import { I18nProvider } from '../../i18n/I18nProvider';
import { Leaderboard } from './Leaderboard';

const rows = (me: number | null): LeaderBoard['top'] =>
  [
    { rank: 1, points: 30 },
    { rank: 1, points: 30 },
    { rank: 2, points: 29 },
    { rank: 3, points: 28 },
    { rank: 4, points: 27 },
  ].map((r, i) => ({ ...r, me: i === me }));

test('in the top 5: five rows, the own row highlighted in place, no separator', () => {
  const board: LeaderBoard = {
    weekKey: '2026-09-26',
    total: 22,
    top: rows(2),
    me: { rank: 2, points: 29, gapToAbove: 1, inTop5: true },
  };
  render(<Leaderboard board={board} myFirstName="بدر" avatarId="b1" />);
  const items = within(screen.getByRole('list')).getAllByRole('listitem');
  expect(items).toHaveLength(5);
  expect(items[2]).toHaveAttribute('aria-current', 'true');
  expect(items[2]).toHaveTextContent('بدر — أنت');
  expect(screen.queryByText('⋯')).toBeNull();
  // others: rank + avatar + points only
  expect(items[0]).not.toHaveTextContent(/[ء-ي]{3,}/);
  expect(screen.getByText('باقي لك نجمتان وتسبق المركز ١')).toBeInTheDocument();
});

test('outside the top 5: the five rows, «⋯», then the own row with the real rank and points', () => {
  const board: LeaderBoard = {
    weekKey: '2026-09-26',
    total: 22,
    top: rows(null),
    me: { rank: 20, points: 4, gapToAbove: 8, inTop5: false },
  };
  render(<Leaderboard board={board} myFirstName="بدر" avatarId="b1" />);
  const list = screen.getByRole('list');
  const items = within(list).getAllByRole('listitem');
  expect(items).toHaveLength(6); // 5 rows + the own row («⋯» is hidden from assistive tech)
  expect(list).toHaveTextContent('⋯');
  const own = items[5]!;
  expect(own).toHaveAttribute('aria-current', 'true');
  expect(own).toHaveTextContent('٢٠');
  expect(own).toHaveTextContent('بدر — أنت');
  expect(own).toHaveTextContent('٤');
  expect(items.slice(0, 5).every((li) => li.getAttribute('aria-current') !== 'true')).toBe(true);
  expect(screen.getByText('باقي لك ٩ نجوم وتسبق المركز ١٩')).toBeInTheDocument();
});

test('first place: «أنت في المركز الأول هذا الأسبوع — استمر!»', () => {
  const board: LeaderBoard = {
    weekKey: '2026-09-26',
    total: 3,
    top: rows(0).slice(0, 3),
    me: { rank: 1, points: 30, gapToAbove: null, inTop5: true },
  };
  render(<Leaderboard board={board} myFirstName="بدر" avatarId="b1" />);
  expect(screen.getByText('أنت في المركز الأول هذا الأسبوع — استمر!')).toBeInTheDocument();
});

describe('in English / Indonesian (inside the child area provider)', () => {
  const board: LeaderBoard = {
    weekKey: '2026-09-26',
    total: 22,
    top: rows(null),
    me: { rank: 20, points: 4, gapToAbove: 8, inTop5: false },
  };
  const inLang = (lang: 'en' | 'id', b: LeaderBoard = board) => {
    localStorage.setItem(STORAGE_KEY, lang);
    return render(
      <I18nProvider>
        <Leaderboard board={b} myFirstName="بدر" avatarId="b1" />
      </I18nProvider>,
    );
  };
  afterEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
  });

  test('English: copy, the own row, Latin digits, ltr', () => {
    inLang('en');
    expect(screen.getByRole('heading', { name: "This week's leaderboard" })).toBeInTheDocument();
    const own = within(screen.getByRole('list')).getAllByRole('listitem')[5]!;
    expect(own).toHaveTextContent('20');
    expect(own).toHaveTextContent('بدر — you');
    expect(screen.getByText('Just 9 stars more to pass place 19')).toBeInTheDocument();
    expect(screen.getByText(/days? left$/)).toBeInTheDocument();
    expect(
      screen.getByText('The competition starts again every week — a new chance for everyone.'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/[٠-٩]/);
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  });

  test('Indonesian: copy and Latin digits', () => {
    inLang('id');
    expect(screen.getByRole('heading', { name: 'Papan peringkat pekan ini' })).toBeInTheDocument();
    expect(screen.getByText('بدر — kamu')).toBeInTheDocument();
    expect(screen.getByText('Tinggal 9 bintang lagi untuk menyalip peringkat 19')).toBeInTheDocument();
    expect(screen.getByText(/hari lagi$/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/[٠-٩]/);
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  });

  test('first place in English', () => {
    inLang('en', { ...board, top: rows(0), me: { rank: 1, points: 30, gapToAbove: null, inTop5: true } });
    expect(screen.getByText("You're in first place this week — keep going!")).toBeInTheDocument();
  });
});
