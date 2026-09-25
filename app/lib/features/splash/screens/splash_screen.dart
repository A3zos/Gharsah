import 'dart:async';

import 'package:flutter/material.dart';

import '../../../theme/app_theme.dart';
import '../../../widgets/app_icons.dart';
import '../../../widgets/decor_blob.dart';
import '../data/splash_ayat_repository.dart';

/// Frame 01 — the ayah splash. Advances after [holdFor] or on tap.
class SplashScreen extends StatefulWidget {
  const SplashScreen({
    super.key,
    required this.onDone,
    this.repository = const SplashAyatRepository(),
    this.holdFor = const Duration(milliseconds: 2800),
    this.autoAdvance = true,
    this.debugAyahIndex,
  });

  final VoidCallback onDone;
  final SplashAyatRepository repository;
  final Duration holdFor;
  final bool autoAdvance;

  /// Debug previews only: pin a specific ayah instead of rotating.
  final int? debugAyahIndex;

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  // One 2.4s timeline; each element animates in its own slice (from the design's keyframes).
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2400),
  );
  late final Animation<double> _logo = CurvedAnimation(
    parent: _c,
    curve: const Interval(0.02, 0.48, curve: Curves.ease),
  );
  late final Animation<double> _ayah = CurvedAnimation(
    parent: _c,
    curve: const Interval(0.17, 0.67, curve: Curves.ease),
  );
  late final Animation<double> _brand = CurvedAnimation(
    parent: _c,
    curve: const Interval(0.42, 1, curve: Curves.ease),
  );

  SplashAyah? _ayahData;
  Timer? _timer;
  bool _done = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final SplashAyah a;
    if (widget.debugAyahIndex != null) {
      final all = await widget.repository.loadAll();
      a = all[widget.debugAyahIndex! % all.length];
    } else {
      a = await widget.repository.nextForLaunch();
    }
    if (!mounted) return;
    setState(() => _ayahData = a);
    _c.forward();
    if (widget.autoAdvance) _timer = Timer(widget.holdFor, _finish);
  }

  void _finish() {
    if (_done) return;
    _done = true;
    _timer?.cancel();
    widget.onDone();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final ayah = _ayahData;
    return Scaffold(
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _finish,
        child: Stack(
          children: [
            DecorBlob(
              top: -200,
              left: -160,
              size: 470,
              color: AppColors.blobGreen,
            ),
            DecorBlob(
              bottom: -130,
              right: -100,
              size: 320,
              color: AppColors.blobGold,
            ),
            SafeArea(
              child: Stack(
                children: [
                  Center(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 3,
                        vertical: 64,
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          FadeTransition(
                            opacity: _logo,
                            child: ScaleTransition(
                              scale: Tween(
                                begin: 0.84,
                                end: 1.0,
                              ).animate(_logo),
                              child: AppIcon.logo(size: AppSizes.logoSplash),
                            ),
                          ),
                          // Design gap is 36 (see the ayah → reference gap below).
                          const SizedBox(height: 36),
                          if (ayah != null)
                            FadeTransition(
                              opacity: _ayah,
                              child: SlideTransition(
                                position: Tween(
                                  begin: const Offset(0, 0.08),
                                  end: Offset.zero,
                                ).animate(_ayah),
                                child: _AyahBlock(ayah: ayah),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 70,
                    child: FadeTransition(
                      opacity: _brand,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 52,
                            height: 3,
                            decoration: BoxDecoration(
                              color: AppColors.borderStrong,
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text('غَرْسة', style: t.displayMedium),
                          const SizedBox(height: 8),
                          Text(
                            'نغرس حُبّ القرآن… ويكبر معهم',
                            style: AppTextStyles.tagline,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AyahBlock extends StatelessWidget {
  const _AyahBlock({required this.ayah});

  final SplashAyah ayah;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '${ayah.text}، ${ayah.reference}',
      excludeSemantics: true,
      child: Column(
        children: [
          Text.rich(
            TextSpan(
              style: AppTextStyles.ayah,
              children: [
                TextSpan(text: '﴿', style: AppTextStyles.ayahBracket),
                // Non-breaking spaces keep each bracket on the same line as the
                // ayah's first/last word. The ayah text itself is untouched.
                TextSpan(text: '\u00A0${ayah.text}\u00A0'),
                TextSpan(text: '﴾', style: AppTextStyles.ayahBracket),
              ],
            ),
            textAlign: TextAlign.center,
          ),
          // 24 + 9: Flutter's 2.05 line box for Amiri Quran ends ~9px higher
          // than Chrome's; this keeps the reference where the frame has it.
          const SizedBox(height: 24 + 9),
          Text(ayah.reference, style: AppTextStyles.ayahRef),
        ],
      ),
    );
  }
}
