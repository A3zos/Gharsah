import 'dart:async';
import 'dart:convert';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The child device's link to one child, returned by `claimPairingCode`.
///
/// The server is the source of truth (childSessions/{deviceUid}); this device
/// only caches the verified session so the child needn't re-enter the code.
/// The child never enters personal data — the first name comes from the parent.
class ChildSession {
  const ChildSession({
    required this.deviceUid,
    required this.parentUid,
    required this.childId,
    required this.name,
    required this.avatar,
    required this.gender,
  });

  factory ChildSession.fromJson(Map<String, dynamic> j) => ChildSession(
    deviceUid: j['deviceUid'] as String,
    parentUid: j['parentUid'] as String,
    childId: j['childId'] as String,
    name: j['name'] as String,
    avatar: j['avatar'] as String,
    gender: j['gender'] as String,
  );

  final String deviceUid;
  final String parentUid;
  final String childId;
  final String name;
  final String avatar;
  final String gender;

  Map<String, dynamic> toJson() => {
    'deviceUid': deviceUid,
    'parentUid': parentUid,
    'childId': childId,
    'name': name,
    'avatar': avatar,
    'gender': gender,
  };
}

/// Why a code wasn't accepted (frame 03 shows «الرمز غير صحيح» for [wrong];
/// the others have no designed state yet — TODO(design)).
enum ClaimError { wrong, tooManyAttempts, offline, unknown }

class ClaimFailure implements Exception {
  const ClaimFailure(this.error);
  final ClaimError error;

  @override
  String toString() => 'ClaimFailure($error)';
}

abstract interface class ChildSessionRepository {
  /// The linked child on this device, or null (listenable for routing).
  ValueListenable<ChildSession?> get session;

  /// True after the parent revoked this device — the app then opens the
  /// child code screen instead of the welcome screen.
  bool get wasRevoked;

  /// Signs this device in anonymously and claims [code] (6 Latin digits).
  /// Throws [ClaimFailure].
  Future<ChildSession> claim(String code);

  /// Server-side check of [s]: emits false once the server confirms the
  /// session is gone (revoked / replaced). Offline keeps the cached session.
  Stream<bool> watchLinked(ChildSession s);

  /// Forgets the session on this device and signs the anonymous user out.
  Future<void> clear({bool revoked = false});
}

class FirebaseChildSessionRepository implements ChildSessionRepository {
  FirebaseChildSessionRepository._(
    this._prefs,
    this._auth,
    this._db,
    this._fn,
    ChildSession? cached,
  ) : _session = ValueNotifier(cached);

  static const _key = 'child_session_v1';

  /// Restores the cached session if this device is still signed in as the
  /// same anonymous user; otherwise drops it.
  static Future<FirebaseChildSessionRepository> load({
    FirebaseAuth? auth,
    FirebaseFirestore? db,
    FirebaseFunctions? functions,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final a = auth ?? FirebaseAuth.instance;
    ChildSession? cached;
    final raw = prefs.getString(_key);
    if (raw != null) {
      try {
        cached = ChildSession.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      } on Object {
        cached = null;
      }
      final user = a.currentUser;
      if (cached != null &&
          (user == null || !user.isAnonymous || user.uid != cached.deviceUid)) {
        cached = null;
      }
      if (cached == null) await prefs.remove(_key);
    }
    return FirebaseChildSessionRepository._(
      prefs,
      a,
      db ?? FirebaseFirestore.instance,
      functions ?? FirebaseFunctions.instanceFor(region: 'us-central1'),
      cached,
    );
  }

  final SharedPreferences _prefs;
  final FirebaseAuth _auth;
  final FirebaseFirestore _db;
  final FirebaseFunctions _fn;
  final ValueNotifier<ChildSession?> _session;
  bool _revoked = false;

  @override
  ValueListenable<ChildSession?> get session => _session;

  @override
  bool get wasRevoked => _revoked;

  @override
  Future<ChildSession> claim(String code) async {
    try {
      var user = _auth.currentUser;
      if (user == null || !user.isAnonymous) {
        user = (await _auth.signInAnonymously()).user!;
      }
      final r = await _fn
          .httpsCallable('claimPairingCode')
          .call<Map<Object?, Object?>>({'code': code});
      final d = r.data;
      final s = ChildSession(
        deviceUid: user.uid,
        parentUid: d['parentUid']! as String,
        childId: d['childId']! as String,
        name: d['name']! as String,
        avatar: d['avatar']! as String,
        gender: d['gender']! as String,
      );
      await _prefs.setString(_key, jsonEncode(s.toJson()));
      _revoked = false;
      _session.value = s;
      return s;
    } on FirebaseFunctionsException catch (e) {
      throw ClaimFailure(switch (e.code) {
        'not-found' || 'invalid-argument' => ClaimError.wrong,
        'resource-exhausted' => ClaimError.tooManyAttempts,
        'unavailable' || 'deadline-exceeded' => ClaimError.offline,
        _ => ClaimError.unknown,
      });
    } on FirebaseAuthException catch (e) {
      throw ClaimFailure(
        e.code == 'network-request-failed'
            ? ClaimError.offline
            : ClaimError.unknown,
      );
    }
  }

  @override
  Stream<bool> watchLinked(ChildSession s) => _db
      .doc('childSessions/${s.deviceUid}')
      .snapshots(includeMetadataChanges: true)
      .where((d) => !d.metadata.isFromCache) // only trust the server
      .map(
        (d) =>
            d.exists &&
            d.data()?['parentUid'] == s.parentUid &&
            d.data()?['childId'] == s.childId,
      )
      .handleError((Object e) {
        // permission-denied = the session doc is gone (revoked) or the
        // anonymous user changed; anything else (offline) keeps the session.
        if (e is FirebaseException && e.code == 'permission-denied') return;
        debugPrint('Session check failed: $e');
      });

  @override
  Future<void> clear({bool revoked = false}) async {
    _revoked = revoked;
    await _prefs.remove(_key);
    _session.value = null;
    if (_auth.currentUser?.isAnonymous ?? false) await _auth.signOut();
  }
}
