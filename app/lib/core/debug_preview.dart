import 'package:flutter/foundation.dart';

/// Debug-only deep links used to screenshot a single screen on web for design
/// comparison, e.g. `http://localhost:8790/?screen=splash&ayah=2`.
/// Works in debug and profile web builds (used by tool/design_compare);
/// always null in release builds and on mobile.
abstract final class DebugPreview {
  static String? get screen => _param('screen');

  static int? intParam(String key) => int.tryParse(_param(key) ?? '');

  static String? _param(String key) {
    if (kReleaseMode || !kIsWeb) return null;
    return Uri.base.queryParameters[key];
  }
}
