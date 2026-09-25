import 'package:flutter/foundation.dart';

/// Debug-only deep links used to screenshot a single screen for design
/// comparison, e.g. `http://localhost:8790/?screen=splash&ayah=2` on web, or
/// `flutter build apk --debug --dart-define=PREVIEW=screen=font-check` on
/// Android. Works in debug and profile web builds (used by
/// tool/design_compare) and debug mobile builds; always null in release.
abstract final class DebugPreview {
  static String? get screen => _param('screen');

  static int? intParam(String key) => int.tryParse(_param(key) ?? '');

  static const _mobileQuery = String.fromEnvironment('PREVIEW');

  static String? _param(String key) {
    if (kReleaseMode) return null;
    if (kIsWeb) return Uri.base.queryParameters[key];
    if (!kDebugMode || _mobileQuery.isEmpty) return null;
    return Uri.splitQueryString(_mobileQuery)[key];
  }
}
