// The parent account (email/password) on Supabase Auth. The `parents` row is
// created by the database (handle_new_user trigger) from the sign-up metadata.
// Every function throws AuthFailure.
import { supabase } from '../supabase/client';
import { MESSAGES, type UiLanguage } from '../i18n/i18n';
import { authFailure, toAuthFailure } from './authFailure';

export const MIN_PASSWORD_LENGTH = 8;

export const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

const origin = () => (typeof window === 'undefined' ? undefined : window.location.origin);

/**
 * Creates the parent (the trigger adds `parents`). When the project requires
 * email confirmation there is no session yet → AuthFailure('confirm-email').
 */
/** The parent account: the name and the country (SA / US / ID) go in the metadata → parents. */
export async function signUp(
  name: string,
  email: string,
  password: string,
  country: 'SA' | 'US' | 'ID' = 'SA',
): Promise<void> {
  const { data, error } = await supabase().auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { name: name.trim(), country },
      emailRedirectTo: origin() && `${origin()}/login?tab=parent`,
    },
  });
  if (error) throw toAuthFailure(error);
  // An existing confirmed email comes back with no identities (no enumeration error).
  if (data.user && data.user.identities?.length === 0) throw toAuthFailure({ code: 'user_already_exists' });
  if (!data.session) throw toAuthFailure({ code: 'confirm-email' });
}

export async function signIn(email: string, password: string): Promise<void> {
  const { data, error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw toAuthFailure(error);
  if (data.user?.is_anonymous) throw authFailure('unknown');
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: origin() && `${origin()}/login?tab=parent`,
  });
  // Supabase never reveals whether an email has an account.
  if (error) throw toAuthFailure(error);
}

export async function resendEmailVerification(): Promise<void> {
  const { data } = await supabase().auth.getUser();
  const email = data.user?.email;
  if (!email) return;
  const { error } = await supabase().auth.resend({ type: 'signup', email });
  if (error) throw toAuthFailure(error);
}

export async function signOut(): Promise<void> {
  await supabase().auth.signOut();
}

/** Password strength for the Signup meter (0–3 bars; design shows 2 = «جيدة»), labelled in `lang`. */
export function passwordStrength(
  pw: string,
  lang: UiLanguage = 'ar',
): { bars: 0 | 1 | 2 | 3; label: string } {
  const t = MESSAGES[lang].auth.strength;
  if (!pw) return { bars: 0, label: '' };
  if (pw.length < MIN_PASSWORD_LENGTH) return { bars: 1, label: t.short };
  const kinds = [/[a-z]/i, /\d/, /[^a-z\d]/i].filter((r) => r.test(pw)).length;
  if (kinds >= 3 || (kinds >= 2 && pw.length >= 12)) return { bars: 3, label: t.strong };
  return { bars: 2, label: t.good };
}
