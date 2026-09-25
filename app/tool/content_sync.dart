import 'dart:convert';
import 'dart:io';

/// Mirror of repo-root content/ into app/assets/, driven by
/// content/sync-map.json. Used by tool/sync_content.dart and
/// test/content_drift_test.dart.
class ContentSync {
  ContentSync(this.contentDir, this.appDir, this.entries);

  factory ContentSync.fromAppDir(Directory appDir) {
    final contentDir = Directory('${appDir.path}/../content');
    final map =
        jsonDecode(File('${contentDir.path}/sync-map.json').readAsStringSync())
            as Map<String, dynamic>;
    final entries = [
      for (final e in map['entries'] as List)
        (from: e['from'] as String, to: e['to'] as String),
    ];
    return ContentSync(contentDir, appDir, entries);
  }

  final Directory contentDir;
  final Directory appDir;
  final List<({String from, String to})> entries;

  /// (source file, mirrored file) for every file content/ should provide,
  /// plus stray files in a mirrored directory (source == null).
  List<(File?, File)> _pairs() {
    final pairs = <(File?, File)>[];
    for (final e in entries) {
      if (!e.from.endsWith('/')) {
        pairs.add((
          File('${contentDir.path}/${e.from}'),
          File('${appDir.path}/${e.to}'),
        ));
        continue;
      }
      final src = Directory('${contentDir.path}/${e.from}');
      final dst = Directory('${appDir.path}/${e.to}');
      final names = <String>{};
      for (final f in src.listSync().whereType<File>()) {
        final name = f.uri.pathSegments.last;
        names.add(name);
        pairs.add((f, File('${dst.path}$name')));
      }
      if (dst.existsSync()) {
        for (final f in dst.listSync().whereType<File>()) {
          if (!names.contains(f.uri.pathSegments.last)) pairs.add((null, f));
        }
      }
    }
    return pairs;
  }

  String _rel(File f) => f.path.replaceFirst('${appDir.path}/', 'app/');

  /// Human-readable differences; empty when the mirror is exact.
  List<String> diff() {
    final out = <String>[];
    for (final (src, dst) in _pairs()) {
      if (src == null) {
        out.add('extra   ${_rel(dst)} (not in content/)');
      } else if (!src.existsSync()) {
        out.add('missing source ${src.path}');
      } else if (!dst.existsSync()) {
        out.add('missing ${_rel(dst)}');
      } else if (!_sameBytes(src, dst)) {
        out.add('changed ${_rel(dst)}');
      }
    }
    return out;
  }

  void apply() {
    for (final (src, dst) in _pairs()) {
      if (src == null) {
        dst.deleteSync();
      } else if (!dst.existsSync() || !_sameBytes(src, dst)) {
        dst.parent.createSync(recursive: true);
        src.copySync(dst.path);
      }
    }
  }

  static bool _sameBytes(File a, File b) {
    final x = a.readAsBytesSync();
    final y = b.readAsBytesSync();
    if (x.length != y.length) return false;
    for (var i = 0; i < x.length; i++) {
      if (x[i] != y[i]) return false;
    }
    return true;
  }
}
