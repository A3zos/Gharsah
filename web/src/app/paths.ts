/** Typed URL helpers — screens link through these, never hand-built strings. */
export const paths = {
  landing: '/',
  /** 02 — the welcome choice (تسجيل دخول / إنشاء حساب). */
  welcome: '/login',
  /** 03 — parent tab of the login screen. */
  login: '/login?tab=parent',
  /** 03 — child tab (pairing code). */
  childCode: '/login?tab=child',
  signup: '/signup',
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
    childCode: (childId: string) => `/parent/children/${encodeURIComponent(childId)}/code`,
    settings: '/parent/settings',
  },

  child: {
    root: '/child',
    home: '/child/home',
    profile: '/child/profile',
    lesson: (lessonId: string) => `/child/lesson/${encodeURIComponent(lessonId)}`,
  },
} as const;
