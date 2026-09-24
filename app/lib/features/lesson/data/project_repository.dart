import 'dart:convert';

import 'package:flutter/services.dart';

/// A weekly practical project (frames 21–23), from `assets/data/projects.json`.
class ProjectContent {
  const ProjectContent({
    required this.id,
    required this.title,
    required this.intro,
    required this.tomorrow,
    required this.reportAsk,
    required this.hints,
  });

  factory ProjectContent.fromJson(Map<String, dynamic> j) => ProjectContent(
    id: j['id'] as String,
    title: j['title'] as String,
    intro: j['intro'] as String,
    tomorrow: j['tomorrow'] as String,
    reportAsk: j['reportAsk'] as String,
    hints: (j['hints'] as List).cast<String>(),
  );

  final String id;
  final String title;
  final String intro;
  final String tomorrow;
  final String reportAsk;
  final List<String> hints;
}

class ProjectRepository {
  ProjectRepository(Iterable<ProjectContent> all)
    : _byId = {for (final p in all) p.id: p};

  static const asset = 'assets/data/projects.json';

  factory ProjectRepository.fromJson(Map<String, dynamic> j) =>
      ProjectRepository([
        for (final p in (j['projects'] as List).cast<Map<String, dynamic>>())
          ProjectContent.fromJson(p),
      ]);

  static Future<ProjectRepository> load([AssetBundle? bundle]) async =>
      ProjectRepository.fromJson(
        jsonDecode(await (bundle ?? rootBundle).loadString(asset))
            as Map<String, dynamic>,
      );

  final Map<String, ProjectContent> _byId;

  ProjectContent byId(String id) =>
      _byId[id] ?? (throw StateError('Unknown project id $id'));
}
