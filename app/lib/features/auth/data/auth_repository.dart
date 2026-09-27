import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/supa.dart';
import 'app_user.dart';
import 'auth_failure.dart';

/// The only place that talks to Supabase Auth for parents. Screens use this,
/// never Supabase directly. Every method throws [AuthFailure] (Arabic message).
/// The `parents` row is created by the database (handle_new_user trigger) from
/// the sign-up metadata.
class AuthRepository {
  GoTrueClient get _auth => supa.auth;

  static const int minPasswordLength = 8;

  /// Emits on sign-in, sign-out and user updates (name, email confirmation).
  Stream<AppUser?> userChanges() =>
      _auth.onAuthStateChange.map((s) => _toAppUser(s.session?.user));

  AppUser? get currentUser => _toAppUser(_auth.currentUser);

  /// Creates the parent account. When the project requires email confirmation
  /// there is no session yet → [AuthFailure] 'confirm-email'.
  Future<void> signUp({
    required String name,
    required String email,
    required String password,
  }) async {
    final AuthResponse r;
    try {
      r = await _auth.signUp(
        email: email.trim().toLowerCase(),
        password: password,
        data: {'name': name.trim()},
      );
    } on Object catch (e) {
      throw authFailureOf(e);
    }
    // An existing confirmed email comes back with no identities.
    if (r.user != null && (r.user!.identities?.isEmpty ?? false)) {
      throw AuthFailure.fromCode('user_already_exists');
    }
    if (r.session == null) throw AuthFailure.fromCode('confirm-email');
  }

  Future<void> signIn({required String email, required String password}) async {
    try {
      await _auth.signInWithPassword(email: email.trim(), password: password);
    } on Object catch (e) {
      throw authFailureOf(e);
    }
  }

  /// Supabase never reveals whether an email has an account.
  Future<void> sendPasswordReset(String email) async {
    try {
      await _auth.resetPasswordForEmail(email.trim());
    } on Object catch (e) {
      throw authFailureOf(e);
    }
  }

  Future<void> resendEmailVerification() async {
    final email = _auth.currentUser?.email;
    if (email == null) return;
    try {
      await _auth.resend(type: OtpType.signup, email: email);
    } on Object catch (e) {
      throw authFailureOf(e);
    }
  }

  /// Re-fetches the user so a confirmation done in the mail app shows up.
  Future<void> reloadUser() async {
    try {
      await _auth.refreshSession();
    } on Object catch (e) {
      debugPrint('refreshSession failed: $e');
      throw authFailureOf(e);
    }
  }

  Future<void> signOut() => _auth.signOut();

  /// «حذف الحساب»: the delete-account Edge Function removes the auth user; the
  /// database cascades to children, progress and submissions.
  Future<void> deleteAccount() async {
    try {
      await callFunction('delete-account', const {});
    } on FunctionCallError {
      throw AuthFailure.fromCode('unavailable');
    }
    await _auth.signOut();
  }

  static AppUser? _toAppUser(User? u) => u == null
      ? null
      : AppUser(
          uid: u.id,
          email: u.email,
          displayName: u.userMetadata?['name'] as String?,
          emailVerified: u.emailConfirmedAt != null,
          isAnonymous: u.isAnonymous,
        );
}
