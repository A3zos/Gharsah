// Plan contents and prices shown on the web (design/v3 — landing, web plans, Packages).
// Buying happens only in the Android app through Google Play Billing (CLAUDE.md §3).

// The plans' copy (names, contents, tags) lives in src/i18n/*.json → plans.

/** Prices in SAR, shown in the UI language's digits. */
export const PRICE_SAR = { annual: 119, monthly: 29 } as const;
/** «أقل من ١٠ ريالات في الشهر» — the yearly plan per month, rounded up. */
export const ANNUAL_MONTHLY_UNDER = 10;

/** The monthly plan covers one child (design/v3 PackagesLimit). */
export const MONTHLY_MAX_CHILDREN = 1;
/** The pilot package (plan 'trial') covers up to 3 children per family (the database enforces it). */
export const PILOT_MAX_CHILDREN = 3;

/** Children a plan covers (null = unlimited) — same numbers as `plan_catalog`. */
export const maxChildren = (plan: 'annual' | 'monthly' | 'trial'): number | null =>
  plan === 'monthly' ? MONTHLY_MAX_CHILDREN : plan === 'trial' ? PILOT_MAX_CHILDREN : null;
