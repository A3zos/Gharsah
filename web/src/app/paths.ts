/** Typed URL helpers — screens link through these, never hand-built strings. */
export const paths = {
  landing: '/',
  /** 02 — the welcome choice (تسجيل دخول / إنشاء حساب). */
  welcome: '/login',
  /** 03 — parent tab of the login screen. */
  login: '/login?tab=parent',
  /** 03 — child tab (pairing code). */
  childCode: '/login?tab=child',
  /** Login on a tab, returning to `next` (a /parent or /child path) afterwards. */
  loginTo: (tab: 'parent' | 'child', next?: string) =>
    `/login?tab=${tab}${next ? `&next=${encodeURIComponent(next)}` : ''}`,
  signup: '/signup',
  /** Admin statistics — never linked from the normal UI. */
  admin: '/admin',
  forgotPassword: '/forgot-password',
  legal: '/legal',
  terms: '/legal?doc=terms',
  privacy: '/legal?doc=privacy',

  parent: {
    root: '/parent',
    dashboard: (childId?: string) =>
      childId ? `/parent/dashboard/${encodeURIComponent(childId)}` : '/parent/dashboard',
    plans: '/parent/plans',
    children: '/parent/children',
    addChild: '/parent/children/new',
    /** Add child, remembering where it was opened (its first-step «رجوع» returns there). */
    addChildFrom: (from: 'children' | 'plans' | 'dashboard') => `/parent/children/new?from=${from}`,
    editSchedule: (childId: string) =>
      `/parent/children/new?child=${encodeURIComponent(childId)}&from=children`,
    childCode: (childId: string) => `/parent/children/${encodeURIComponent(childId)}/code`,
    settings: '/parent/settings',
  },

  child: {
    root: '/child',
    home: '/child/home',
    profile: '/child/profile',
    weeklyReview: '/child/weekly-review',
    review: (kind: 'quran' | 'hadith' | 'projects') => `/child/review/${kind}`,
    lesson: (lessonId: string) => `/child/lesson/${encodeURIComponent(lessonId)}`,
  },
} as const;
