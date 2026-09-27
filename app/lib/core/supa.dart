import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// The Supabase project the app talks to (anon key only — never a service key).
/// Values come from `--dart-define-from-file=env/supabase.json`
/// (template: env/supabase.example.json).
abstract final class SupaConfig {
  static const url = String.fromEnvironment('SUPABASE_URL');
  static const anonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

  static Future<void> init() async {
    if (url.isEmpty || anonKey.isEmpty) {
      throw StateError(
        'SUPABASE_URL / SUPABASE_ANON_KEY are missing — run with '
        '--dart-define-from-file=env/supabase.json (see env/supabase.example.json).',
      );
    }
    // The legacy anon key works as the publishable key.
    await Supabase.initialize(url: url, publishableKey: anonKey);
  }
}

/// The one client (after [SupaConfig.init]).
SupabaseClient get supa => Supabase.instance.client;

/// A table to watch for a live query (optionally filtered by `column = value`).
class Watched {
  const Watched(this.table, {this.column, this.value});
  final String table;
  final String? column;
  final Object? value;
}

int _seq = 0;

/// Live query: loads once, then reloads whenever Realtime reports a change on one
/// of [tables] (RLS applies to Realtime too). Replaces Firestore snapshots.
Stream<T> watchQuery<T>(List<Watched> tables, Future<T> Function() load) {
  late final StreamController<T> controller;
  RealtimeChannel? channel;
  var running = false;
  var again = false;

  Future<void> run() async {
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      final v = await load();
      if (!controller.isClosed) controller.add(v);
    } on Object catch (e, st) {
      if (!controller.isClosed) controller.addError(e, st);
    } finally {
      running = false;
      if (again && !controller.isClosed) {
        again = false;
        unawaited(run());
      }
    }
  }

  controller = StreamController<T>(
    onListen: () {
      unawaited(run());
      var ch = supa.channel(
        'live-${++_seq}-${tables.map((t) => t.table).join('-')}',
      );
      for (final t in tables) {
        ch = ch.onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: t.table,
          filter: t.column == null
              ? null
              : PostgresChangeFilter(
                  type: PostgresChangeFilterType.eq,
                  column: t.column!,
                  value: t.value,
                ),
          callback: (_) => unawaited(run()),
        );
      }
      channel = ch..subscribe();
    },
    onCancel: () async {
      final ch = channel;
      if (ch != null) await supa.removeChannel(ch);
      await controller.close();
    },
  );
  return controller.stream;
}

/// An Edge Function call failed: [code] is the function's own `{error}` value,
/// 'network' when the request never arrived, or 'unavailable' when the function
/// isn't reachable (e.g. not deployed).
class FunctionCallError implements Exception {
  const FunctionCallError(this.code, [this.status = 0]);
  final String code;
  final int status;

  @override
  String toString() => 'FunctionCallError($code, $status)';
}

/// Invokes an Edge Function; returns its JSON body or throws [FunctionCallError].
Future<Map<String, dynamic>> callFunction(
  String name,
  Map<String, dynamic> body,
) async {
  try {
    final r = await supa.functions.invoke(name, body: body);
    final data = r.data;
    return data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
  } on FunctionException catch (e) {
    final d = e.details;
    final code = d is Map && d['error'] is String
        ? d['error'] as String
        : 'unavailable';
    throw FunctionCallError(code, e.status);
  } on FunctionCallError {
    rethrow;
  } on Object catch (e) {
    // SocketException / ClientException / TimeoutException: never arrived.
    debugPrint('[$name] $e');
    throw const FunctionCallError('network');
  }
}

/// A date from the server: an ISO string (Postgres JSON / timestamptz) or null.
DateTime? parseDate(Object? v) =>
    v is String ? DateTime.tryParse(v)?.toLocal() : (v is DateTime ? v : null);
