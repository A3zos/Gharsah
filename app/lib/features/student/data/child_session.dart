import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show AuthException;

import '../../../core/supa.dart';

/// The child device's pairing to one child, returned by `claim-pairing-code`.
///
/// The server is the source of truth (`child_sessions`); this device only
/// caches the verified session so the child needn't re-enter the code.
/// The child never enters personal data — the first name comes from the parent.
class ChildSession {
  const ChildSession({
    required this.deviceUid,
    required this.parentUid,
    required this.childId,
    required this.name,
    required this.avatar,
    required this.gender,
    this.debugMock = false,
  });

  /// DEBUG builds only: the in-memory mock child «عبدالله» (no server, not
  /// cached). Never true in a release build.
  factory ChildSession.debugMockChild() {
    assert(kDebugMode, 'debug mock child in a release build');
    return const ChildSession(
      deviceUid: 'debug-device',
      parentUid: 'debug-parent',
      childId: 'mock-abdullah',
      name: 'عبدالله',
      avatar: 'boy-1',
      gender: 'boy',
      debugMock: true,
    );
  }

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
  final bool debugMock;

  Map<String, dynamic> toJson() => {
    'deviceUid': deviceUid,
    'parentUid': parentUid,
    'childId': childId,
    'name': name,
    'avatar': avatar,
    'gender': gender,
  };
}

/// Why a code wasn't accepted (review notes A2 — same messages as the web).
enum ClaimError { wrong, tooManyAttempts, offline, unavailable }

/// Server/transport code → what the child sees (same rules as the web's
/// claimErrorOf). `wrong-code`/`bad-code` come from the function for a wrong,
/// expired or used code; `network` means the request never arrived; anything
/// else (function not deployed, anonymous sign-ins disabled, internal) means
/// the service is unavailable.
ClaimError claimErrorOf(String code, {bool online = true}) {
  if (code == 'wrong-code' || code == 'bad-code') return ClaimError.wrong;
  if (code == 'too-many-attempts') return ClaimError.tooManyAttempts;
  if (!online || code == 'network') return ClaimError.offline;
  return ClaimError.unavailable;
}

class ClaimFailure implements Exception {
  const ClaimFailure(this.error);
  final ClaimError error;

  @override
  String toString() => 'ClaimFailure($error)';
}

abstract interface class ChildSessionRepository {
  /// The paired child on this device, or null (listenable for routing).
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

  /// DEBUG builds only: enter the app as the mock child without the server.
  void debugUseMockChild();
}

class SupabaseChildSessionRepository implements ChildSessionRepository {
  SupabaseChildSessionRepository._(this._prefs, ChildSession? cached)
    : _session = ValueNotifier(cached);

  static const _key = 'child_session_v1';

  /// Restores the cached session if this device is still signed in as the
  /// same anonymous user; otherwise drops it.
  static Future<SupabaseChildSessionRepository> load() async {
    final prefs = await SharedPreferences.getInstance();
    ChildSession? cached;
    final raw = prefs.getString(_key);
    if (raw != null) {
      try {
        cached = ChildSession.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      } on Object {
        cached = null;
      }
      final user = supa.auth.currentUser;
      if (cached != null &&
          (user == null || !user.isAnonymous || user.id != cached.deviceUid)) {
        cached = null;
      }
      if (cached == null) await prefs.remove(_key);
    }
    return SupabaseChildSessionRepository._(prefs, cached);
  }

  final SharedPreferences _prefs;
  final ValueNotifier<ChildSession?> _session;
  bool _revoked = false;

  @override
  ValueListenable<ChildSession?> get session => _session;

  @override
  bool get wasRevoked => _revoked;

  @override
  Future<ChildSession> claim(String code) async {
    final auth = supa.auth;
    try {
      var user = auth.currentUser;
      // A parent signed in on this device is signed out first: one identity per device.
      if (user != null && !user.isAnonymous) {
        await auth.signOut();
        user = null;
      }
      if (user == null) {
        try {
          user = (await auth.signInAnonymously()).user!;
        } on AuthException catch (e) {
          // e.g. anonymous_provider_disabled → the service is off.
          debugPrint('[claim-pairing-code] auth/${e.code ?? e.statusCode}');
          throw FunctionCallError(
            e.statusCode == null ? 'network' : 'unavailable',
          );
        }
      }
      final d = await callFunction('claim-pairing-code', {'code': code});
      final s = ChildSession(
        deviceUid: user.id,
        parentUid: d['parentId']! as String,
        childId: d['childId']! as String,
        name: d['name']! as String,
        avatar: d['avatar']! as String,
        gender: d['gender']! as String,
      );
      await _prefs.setString(_key, jsonEncode(s.toJson()));
      _revoked = false;
      _session.value = s;
      return s;
    } on FunctionCallError catch (e) {
      // The raw code tells "not deployed" / "anonymous auth off" apart.
      debugPrint('[claim-pairing-code] ${e.code} ${e.status}');
      throw ClaimFailure(claimErrorOf(e.code));
    } on ClaimFailure {
      rethrow;
    } on Object catch (e) {
      debugPrint('[claim-pairing-code] $e');
      throw ClaimFailure(claimErrorOf('unavailable'));
    }
  }

  @override
  Stream<bool> watchLinked(ChildSession s) =>
      watchQuery(
        [Watched('child_sessions', column: 'device_uid', value: s.deviceUid)],
        () async {
          final r = await supa
              .from('child_sessions')
              .select('parent_id, child_id, revoked')
              .eq('device_uid', s.deviceUid)
              .maybeSingle();
          return r != null &&
              r['revoked'] != true &&
              r['parent_id'] == s.parentUid &&
              r['child_id'] == s.childId;
        },
      ).handleError((Object e) {
        // Offline or a transient error keeps the cached session.
        debugPrint('Session check failed: $e');
      });

  @override
  void debugUseMockChild() {
    if (!kDebugMode) return;
    _revoked = false;
    _session.value = ChildSession.debugMockChild();
  }

  @override
  Future<void> clear({bool revoked = false}) async {
    _revoked = revoked;
    await _prefs.remove(_key);
    _session.value = null;
    if (supa.auth.currentUser?.isAnonymous ?? false) await supa.auth.signOut();
  }
}
