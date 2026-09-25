/** Typed URL helpers — screens link through these, never hand-built strings. */
export const paths = {
  landing: '/',
  login: '/login',
  childCode: '/login?tab=child',
  signup: '/signup',
  forgotPassword: '/forgot-password',

  parent: {
    root: '/parent',
    dashboard: (childId?: string) =>
      childId ? `/parent/dashboard/${encodeURIComponent(childId)}` : '/parent/dashboard',
    plans: '/parent/plans',
    children: '/parent/children',
    addChild: '/parent/children/new',
    childCode: (childId: string) => `/parent/children/${encodeURIComponent(childId)}/code`,
  },

  child: {
    root: '/child',
    home: '/child/home',
    lesson: (lessonId: string) => `/child/lesson/${encodeURIComponent(lessonId)}`,
  },
} as const;
