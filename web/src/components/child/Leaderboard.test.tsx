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

describe('every child: first name + father + flag (product rule 2026-10-05)', () => {
  const named: LeaderBoard = {
    weekKey: '2026-10-03',
    total: 5,
    top: [
      { rank: 1, points: 14, me: false, firstName: 'فهد', fatherName: 'سلمان', country: 'SA' },
      { rank: 2, points: 12, me: false, firstName: 'Rizky', fatherName: 'Ahmad', country: 'ID' },
      { rank: 3, points: 9, me: false, hero: 'girl', country: 'US' },
      { rank: 4, points: 7, me: true, firstName: 'عمر', fatherName: 'عبدالعزيز', country: 'SA' },
      { rank: 5, points: 6, me: false, firstName: 'Adam', country: 'US' },
    ],
    me: {
      rank: 4,
      points: 7,
      gapToAbove: 2,
      inTop5: true,
      firstName: 'عمر',
      fatherName: 'عبدالعزيز',
      country: 'SA',
    },
  };
  afterEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
  });

  test('Arabic: «فهد سلمان» + an SVG flag, «عمر عبدالعزيز — أنت», «بطلة», no emoji flags', () => {
    render(<Leaderboard board={named} myFirstName="عمر" avatarId="boy-1" />);
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('فهد سلمان');
    expect(within(items[0]!).getByRole('img', { name: 'السعودية' }).tagName.toLowerCase()).toBe('svg');
    expect(items[1]).toHaveTextContent('Rizky Ahmad');
    expect(within(items[1]!).getByRole('img', { name: 'إندونيسيا' })).toBeInTheDocument();
    expect(items[2]).toHaveTextContent('بطلة');
    expect(within(items[2]!).getByRole('img', { name: 'الولايات المتحدة' })).toBeInTheDocument();
    expect(items[3]).toHaveTextContent('عمر عبدالعزيز — أنت');
    expect(items[3]).toHaveAttribute('aria-current', 'true');
    expect(items[4]).toHaveTextContent('Adam');
    // the father's name is the muted part
    expect(within(items[0]!).getByText('سلمان')).toHaveClass('text-text-muted');
    expect(document.body.textContent).not.toMatch(/\p{Regional_Indicator}/u);
  });

  test('English: names as typed, «Champ» for a hidden child, English country names', () => {
    localStorage.setItem(STORAGE_KEY, 'en');
    render(
      <I18nProvider>
        <Leaderboard board={named} myFirstName="عمر" avatarId="boy-1" />
      </I18nProvider>,
    );
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('فهد سلمان');
    expect(within(items[0]!).getByRole('img', { name: 'Saudi Arabia' })).toBeInTheDocument();
    expect(items[2]).toHaveTextContent('Champ');
    expect(items[3]).toHaveTextContent('عمر عبدالعزيز — you');
  });

  test('names off for the child themselves: they still see their own first name', () => {
    const b: LeaderBoard = {
      ...named,
      top: named.top.map((r) =>
        r.me ? { rank: r.rank, points: r.points, me: true, hero: 'boy' as const, country: r.country } : r,
      ),
    };
    render(<Leaderboard board={b} myFirstName="عمر" avatarId="boy-1" />);
    expect(within(screen.getByRole('list')).getAllByRole('listitem')[3]).toHaveTextContent('عمر — أنت');
  });
});
