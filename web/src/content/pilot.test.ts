import ar from '../i18n/ar.json';
import en from '../i18n/en.json';
import { PILOT_DAYS, PILOT_ITEMS, pilotCopy } from './pilot';

test('the Arabic plan names in ar.json equal the verified content', () => {
  for (const d of PILOT_DAYS) {
    expect((ar.plans.names.surah as Record<string, string>)[d.surah]).toBe(d.surahName);
    expect((ar.plans.names.hadith as Record<string, string>)[d.hadithId]).toBe(d.hadithTitle);
  }
});

test('every pilot day has English names', () => {
  for (const d of PILOT_DAYS) {
    expect((en.plans.names.surah as Record<string, string>)[d.surah]).toBeTruthy();
    expect((en.plans.names.hadith as Record<string, string>)[d.hadithId]).toBeTruthy();
  }
});

test('the pilot copy in Arabic (unchanged) and in English (Western digits)', () => {
  expect(PILOT_ITEMS).toEqual([
    '٣ سور (الإخلاص، الناس، الفلق)',
    '٣ أحاديث',
    'حصة واحدة كل يوم',
    'حتى ٣ أطفال',
  ]);
  expect(pilotCopy('ar').days).toEqual([
    'اليوم ١: سورة الإخلاص + حديث برّ الوالدين',
    'اليوم ٢: سورة الناس + حديث عن الكذب',
    'اليوم ٣: سورة الفلق + حديث عن الغضب',
  ]);
  const enCopy = pilotCopy('en');
  expect(enCopy).toEqual({
    name: 'Free trial plan',
    price: 'Free',
    cta: 'Start free',
    tag: '3 days — one day at a time',
    items: ['3 surahs (Al-Ikhlas, An-Nas, Al-Falaq)', '3 hadiths', 'One lesson a day', 'Up to 3 children'],
    days: [
      'Day 1: Surah Al-Ikhlas + hadith on kindness to parents',
      'Day 2: Surah An-Nas + hadith on lying',
      'Day 3: Surah Al-Falaq + hadith on anger',
    ],
  });
});

test('the pilot copy in Indonesian', () => {
  const idCopy = pilotCopy('id');
  expect(idCopy.name).toBe('Paket uji coba gratis');
  expect(idCopy.items[0]).toBe('3 surah (Al-Ikhlas, An-Nas, Al-Falaq)');
  expect(idCopy.days[1]).toBe('Hari 2: Surah An-Nas + hadis tentang berbohong');
});
