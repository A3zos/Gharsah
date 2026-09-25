import { index, route, type RouteConfig } from '@react-router/dev/routes';

// URL map (see src/app/paths.ts for the typed helpers screens use).
// Parent and child areas are layout routes with their own guard (parent: signed
// in + parental gate; child: a server-linked device).
export default [
  index('routes/landing.tsx'),

  // Auth (design/v2 Auth + Login; the child tab is /login?tab=child).
  route('login', 'routes/auth/login.tsx'),
  route('signup', 'routes/auth/signup.tsx'),
  route('forgot-password', 'routes/auth/forgot-password.tsx'),
  route('legal', 'routes/legal.tsx'),

  // Parent portal — signed-in parent (non-anonymous) → parental gate → layout.
  route('parent', 'routes/parent/layout.tsx', [
    index('routes/parent/index.tsx'),
    route('dashboard/:childId?', 'routes/parent/dashboard.tsx'),
    route('plans', 'routes/parent/plans.tsx'),
    route('children', 'routes/parent/children.tsx'),
    route('children/new', 'routes/parent/children-new.tsx'),
    route('children/:childId/code', 'routes/parent/child-code.tsx'),
    route('settings', 'routes/parent/settings.tsx'),
  ]),

  // Child — anonymous device linked by claimPairingCode (childSessions/{uid}).
  route('child', 'routes/child/layout.tsx', [
    index('routes/child/index.tsx'),
    route('home', 'routes/child/home.tsx'),
    route('profile', 'routes/child/profile.tsx'),
    route('lesson/:lessonId', 'routes/child/lesson.tsx'),
  ]),

  route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig;
