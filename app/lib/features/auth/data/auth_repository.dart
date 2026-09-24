import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';

import 'app_user.dart';
import 'auth_failure.dart';

/// The only place that talks to FirebaseAuth. Screens use this, never FirebaseAuth directly.
/// Every method throws [AuthFailure] (Arabic message) on error.
class AuthRepository {
  AuthRepository({FirebaseAuth? auth, FirebaseFirestore? firestore})
    : _auth = auth ?? FirebaseAuth.instance,
      _db = firestore ?? FirebaseFirestore.instance;

  final FirebaseAuth _auth;
  final FirebaseFirestore _db;

  static const int minPasswordLength = 8;

  /// Emits on sign-in, sign-out and profile changes (name, email verification).
  Stream<AppUser?> userChanges() => _auth.userChanges().map(_toAppUser);

  AppUser? get currentUser => _toAppUser(_auth.currentUser);

  /// Creates the parent account: Auth user → display name → `parents/{uid}` → verification email.
  Future<void> signUp({
    required String name,
    required String email,
    required String password,
  }) async {
    final UserCredential cred;
    try {
      cred = await _auth.createUserWithEmailAndPassword(
        email: email.trim().toLowerCase(),
        password: password,
      );
    } on FirebaseAuthException catch (e) {
      throw AuthFailure.fromCode(e.code);
    }

    final user = cred.user!;
    try {
      await user.updateDisplayName(name.trim());
      await _db.collection('parents').doc(user.uid).set({
        'name': name.trim(),
        'email': user.email,
        'createdAt': FieldValue.serverTimestamp(),
        'role': 'parent',
      });
    } on FirebaseException catch (e) {
      // Roll back so the parent can retry signup with the same email.
      await _deleteQuietly(user);
      throw AuthFailure.fromCode(e.code);
    }

    try {
      await _auth.setLanguageCode('ar');
      await user.sendEmailVerification();
    } on FirebaseAuthException catch (e) {
      // Not fatal: the home banner lets the parent resend it.
      debugPrint('sendEmailVerification failed: ${e.code}');
    }
    await user.reload();
  }

  Future<void> signIn({required String email, required String password}) async {
    try {
      await _auth.signInWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
    } on FirebaseAuthException catch (e) {
      throw AuthFailure.fromCode(e.code);
    }
  }

  Future<void> sendPasswordReset(String email) async {
    try {
      await _auth.setLanguageCode('ar');
      await _auth.sendPasswordResetEmail(email: email.trim());
    } on FirebaseAuthException catch (e) {
      // With email-enumeration protection Firebase doesn't reveal unknown emails;
      // if it does, don't reveal it either.
      if (e.code == 'user-not-found') return;
      throw AuthFailure.fromCode(e.code);
    }
  }

  Future<void> resendEmailVerification() async {
    final user = _auth.currentUser;
    if (user == null) return;
    try {
      await _auth.setLanguageCode('ar');
      await user.sendEmailVerification();
    } on FirebaseAuthException catch (e) {
      throw AuthFailure.fromCode(e.code);
    }
  }

  /// Re-fetches the user so a verification done in the mail app shows up.
  Future<void> reloadUser() async {
    try {
      await _auth.currentUser?.reload();
    } on FirebaseAuthException catch (e) {
      throw AuthFailure.fromCode(e.code);
    }
  }

  Future<void> signOut() => _auth.signOut();

  Future<void> _deleteQuietly(User user) async {
    try {
      await user.delete();
    } on FirebaseAuthException catch (e) {
      debugPrint('Rollback delete failed: ${e.code}');
      await _auth.signOut();
    }
  }

  static AppUser? _toAppUser(User? u) => u == null
      ? null
      : AppUser(
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          emailVerified: u.emailVerified,
          isAnonymous: u.isAnonymous,
        );
}
