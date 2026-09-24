import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'app_icons.dart';

/// Seed → sprout → tree strip (frames 02 and 12), driven by yearly-plan
/// [progress] 0–100 exactly as in the design: بذرة 0–33, غَرْسة 34–66,
/// شجرة 67–100. The current stage gets a ring and a pulse; later stages are
/// greyed. Nodes pop in, then the connectors draw in.
///
/// Layout follows the approved PNG/HTML (`direction: ltr`): seed on the LEFT.
class GrowthTimeline extends StatefulWidget {
  const GrowthTimeline({super.key, this.progress = 100, this.topPadding = 4});

  final int progress;
  final double topPadding;

  static int stageOf(int progress) =>
      progress < 34 ? 0 : (progress < 67 ? 1 : 2);

  @override
  State<GrowthTimeline> createState() => _GrowthTimelineState();
}

class _GrowthTimelineState extends State<GrowthTimeline>
    with TickerProviderStateMixin {
  // Intro timeline 0–1.74s (design keyframes), then an infinite 2.6s pulse.
  late final AnimationController _intro = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1740),
  );
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2600),
  );

  Animation<double> _slice(double startMs, double lengthMs) => CurvedAnimation(
    parent: _intro,
    curve: Interval(
      startMs / 1740,
      (startMs + lengthMs) / 1740,
      curve: Curves.easeOut,
    ),
  );

  late final _seed = _slice(80, 450);
  late final _line1 = _slice(200, 500);
  late final _sprout = _slice(620, 450);
  late final _line2 = _slice(740, 500);
  late final _tree = _slice(1140, 450);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.of(context).disableAnimations) {
      _intro.value = 1;
    } else if (!_intro.isAnimating && _intro.value == 0) {
      _intro.forward().whenComplete(() {
        if (mounted) _pulse.repeat();
      });
    }
  }

  @override
  void dispose() {
    _intro.dispose();
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.progress.clamp(0, 100);
    final stage = GrowthTimeline.stageOf(p);
    final seg1 = (p / 34).clamp(0.0, 1.0);
    final seg2 = ((p - 34) / 33).clamp(0.0, 1.0);
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Padding(
        padding: EdgeInsets.fromLTRB(2, widget.topPadding, 2, 0),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _Node(
              appear: _seed,
              background: AppColors.goldTint,
              label: 'بذرة',
              reached: true,
              icon: AppIcon.seed(size: 26),
              current: stage == 0,
              pulse: stage == 0 ? _pulse : null,
            ),
            Expanded(
              child: _Connector(progress: _line1, fill: seg1),
            ),
            _Node(
              appear: _sprout,
              background: stage >= 1
                  ? AppColors.greenTint
                  : AppColors.borderSoft,
              label: 'غَرْسة',
              reached: stage >= 1,
              icon: AppIcon.sprout(size: 36, reached: stage >= 1),
              current: stage == 1,
              pulse: stage == 1 ? _pulse : null,
            ),
            Expanded(
              child: _Connector(progress: _line2, fill: seg2),
            ),
            _Node(
              appear: _tree,
              background: stage >= 2
                  ? AppColors.greenTint
                  : AppColors.borderSoft,
              label: 'شجرة',
              reached: stage >= 2,
              icon: AppIcon.tree(size: 44, reached: stage >= 2),
              current: stage == 2,
              pulse: stage == 2 ? _pulse : null,
            ),
          ],
        ),
      ),
    );
  }
}

/// CSS keyframe `gh-pop`: 0 → scale .7, 62% → 1.09, 100% → 1.
class _PopCurve extends Curve {
  const _PopCurve();
  @override
  double transformInternal(double t) => t < 0.62
      ? 0.7 + (1.09 - 0.7) * (t / 0.62)
      : 1.09 - 0.09 * ((t - 0.62) / 0.38);
}

class _Node extends StatelessWidget {
  const _Node({
    required this.appear,
    required this.background,
    required this.label,
    required this.reached,
    required this.icon,
    required this.current,
    this.pulse,
  });

  final Animation<double> appear;
  final Color background;
  final String label;
  final bool reached;
  final Widget icon;
  final bool current;
  final Animation<double>? pulse;

  @override
  Widget build(BuildContext context) {
    const size = AppSizes.timelineNode;
    Widget circle = Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: background,
        shape: BoxShape.circle,
        border: current
            ? Border.all(color: AppColors.primary, width: 2.5)
            : null,
      ),
      child: icon,
    );

    if (pulse != null) {
      // CSS `gh-pulse`: scale 1 → 1.06 → 1 with a ring growing to 11px and fading out.
      circle = AnimatedBuilder(
        animation: pulse!,
        child: circle,
        builder: (context, child) {
          final t = pulse!.value;
          final up = t < 0.55 ? t / 0.55 : 1 - (t - 0.55) / 0.45;
          final ring = t < 0.55 ? t / 0.55 : 1.0;
          return Transform.scale(
            scale: 1 + 0.06 * Curves.easeInOut.transform(up),
            child: DecoratedBox(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(
                      alpha: 0.32 * (1 - ring),
                    ),
                    spreadRadius: 11 * ring,
                  ),
                ],
              ),
              child: child,
            ),
          );
        },
      );
    }

    return SizedBox(
      width: size,
      child: Semantics(
        label: current ? '$label — المرحلة الحالية' : label,
        excludeSemantics: true,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ScaleTransition(
              scale: Tween(
                begin: 0.0,
                end: 1.0,
              ).chain(CurveTween(curve: const _PopCurve())).animate(appear),
              child: FadeTransition(opacity: appear, child: circle),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: AppTextStyles.timelineLabel.copyWith(
                color: reached ? AppColors.deepGreen : AppColors.textFaint,
              ),
              maxLines: 1,
              softWrap: false,
            ),
          ],
        ),
      ),
    );
  }
}

class _Connector extends StatelessWidget {
  const _Connector({required this.progress, required this.fill});

  /// Intro animation 0→1.
  final Animation<double> progress;

  /// How much of this segment is reached (0–1).
  final double fill;

  @override
  Widget build(BuildContext context) {
    // Sits at the vertical centre of the 66px nodes (design: margin-top 32).
    return Padding(
      padding: const EdgeInsets.only(top: 32),
      child: SizedBox(
        height: 2.5,
        child: Stack(
          children: [
            Positioned.fill(child: CustomPaint(painter: _DottedLine())),
            AnimatedBuilder(
              animation: progress,
              builder: (context, _) => FractionallySizedBox(
                alignment: Alignment.centerLeft,
                widthFactor: fill * progress.value,
                heightFactor: 1,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DottedLine extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()..color = AppColors.borderStrong;
    final r = size.height / 2;
    for (double x = r; x < size.width; x += size.height * 2) {
      canvas.drawCircle(Offset(x, r), r, p);
    }
  }

  @override
  bool shouldRepaint(_DottedLine oldDelegate) => false;
}
