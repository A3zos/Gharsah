// Plan contents and prices shown on the web (design/v3 — landing, web plans, Packages).
// Buying happens only in the Android app through Google Play Billing (CLAUDE.md §3).

/** design/v3 plan contents (landing, web plans, Packages). */
export const PLANS = {
  annual: [
    '٦ أجزاء من القرآن',
    '٣٠ حديثًا مع مشاريعها العملية',
    'حصة مراجعة كل أسبوع',
    'عدد غير محدود من الأبناء',
  ],
  monthly: [
    'جزء عمّ كاملًا',
    '٣ أحاديث مع مشاريعها العملية',
    'حصة مراجعة كل أسبوع',
    'لابن واحد',
    'تُلغى متى شئت',
  ],
} as const;

export const PRICE = { annual: '١١٩', monthly: '٢٩' } as const;

/** The monthly plan covers one child (design/v3 PackagesLimit). */
export const MONTHLY_MAX_CHILDREN = 1;
