// The lesson's surah card as a mushaf page: the verified text unchanged, one flowing paragraph,
// a rosette after every ayah (kept with the last word), the basmala rules, current / done states.
import { render, screen } from '@testing-library/react';

import { quranMeta } from '../../content/library';
import { BASMALA, verifiedAyah } from '../../content/verified';
import { MushafSurahCard } from './Mushaf';

function card(surah: number, currentAyah: number | null) {
  const ayat = Array.from({ length: quranMeta.ayahCount(surah) }, (_, i) => ({
    ayah: i + 1,
    text: verifiedAyah(surah, i + 1).text,
  }));
  return render(
    <MushafSurahCard
      surahName={quranMeta.surahName(surah)}
      ayat={ayat}
      currentAyah={currentAyah}
      reciting={false}
      playbackBlocked={false}
      label="surah"
      onTap={() => {}}
      onPlay={() => {}}
    />,
  );
}

test('Al-Ikhlas: header, basmala, ONE paragraph with the exact verified ayat and a rosette per ayah', () => {
  const { container } = card(112, 2);
  expect(screen.getByRole('button', { name: 'surah' })).toBeInTheDocument();
  expect(container.textContent).toContain(`سورة ${quranMeta.surahName(112)}`);
  expect(container.textContent).toContain(BASMALA);
  const paragraphs = container.querySelectorAll('p[lang="ar"]');
  expect(paragraphs).toHaveLength(2); // the basmala line + the ayat paragraph
  const ayat = paragraphs[1]!.querySelectorAll('[data-ayah]');
  expect(ayat).toHaveLength(4);
  ayat.forEach((el, i) => {
    // the text exactly as loaded, then its Arabic-Indic number
    expect(el.textContent).toBe(`${verifiedAyah(112, i + 1).text}${'١٢٣٤'[i]} `);
    // the last word and its rosette never part (a rosette never starts a line)
    expect(el.querySelector('.whitespace-nowrap svg')).not.toBeNull();
  });
  // current ayah highlighted, finished ones faded, the rest normal
  expect(ayat[1]!.className).toContain('bg-gold-tint');
  expect(ayat[0]!.className).toContain('opacity-70');
  expect(ayat[2]!.className).not.toContain('opacity-70');
});

test('no basmala line for Al-Fatiha (it is ayah 1)', () => {
  const { container } = card(1, null);
  expect(container.querySelectorAll('p[lang="ar"]')).toHaveLength(1);
  // the whole surah repeated (no current ayah): nothing highlighted or faded
  const ayat = container.querySelectorAll('[data-ayah]');
  ayat.forEach((el) => expect(el.className).not.toMatch(/bg-gold-tint|opacity-70/));
});
