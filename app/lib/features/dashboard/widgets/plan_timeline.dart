import 'package:flutter/material.dart';

import '../../../core/time_format.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/child_avatar.dart';
import '../../children/data/child_profile.dart';
import '../data/plan_progress.dart';

/// The dashboard's growth card: the child's CURRENT plan as a vertical
/// timeline (RTL; step 1 on top) — مكتمل (check + date) / اليوم (pulsing) /
/// فاته (amber) / مقفل («يُفتح غدًا») — joined by a line that is green up to
/// the current step; then the bar and sentence. The stage is a small badge
/// next to the name. Same as web/src/components/parent/PlanTimeline.tsx.
// TODO(design): no designed plan timeline yet.
class PlanCard extends StatelessWidget {
  const PlanCard({super.key, required this.child, required this.progress});

  final ChildProfile child;
  final PlanProgress progress;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final p = progress;
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 20, 18, 20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.card),
        boxShadow: AppShadows.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              ChildAvatar(child.avatarId, size: 52, radius: 18),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 8,
                      children: [
                        Text(child.name, style: t.headlineSmall),
                        _StageBadge(stage: p.stage),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(p.subtitle(child.age), style: AppTextStyles.caption),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          for (final (i, s) in p.steps.indexed)
            _StepRow(step: s, last: i == p.steps.length - 1),
          const SizedBox(height: 14),
          Semantics(
            label: 'من ${p.plan.name}',
            value: '${p.pct}٪',
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppRadii.progress),
              child: SizedBox(
                height: AppSizes.progressHeight,
                child: Stack(
                  children: [
                    const Positioned.fill(
                      child: ColoredBox(color: AppColors.borderSoft),
                    ),
                    FractionallySizedBox(
                      alignment: AlignmentDirectional.centerStart,
                      widthFactor: p.pct / 100,
                      heightFactor: 1,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(
                            AppRadii.progress,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(p.sentence, style: AppTextStyles.priceUnit),
        ],
      ),
    );
  }
}

class _StageBadge extends StatelessWidget {
  const _StageBadge({required this.stage});

  final PlanStage stage;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 4),
    decoration: BoxDecoration(
      color: AppColors.greenTint,
      borderRadius: BorderRadius.circular(AppRadii.pill),
    ),
    child: Text(
      planStageNames[stage]!,
      style: AppTextStyles.chip.copyWith(
        color: AppColors.deepGreen,
        fontWeight: FontWeight.w800,
      ),
    ),
  );
}

class _StepRow extends StatelessWidget {
  const _StepRow({required this.step, required this.last});

  final TimelineStep step;
  final bool last;

  static const _dot = 34.0;

  @override
  Widget build(BuildContext context) {
    final s = step;
    final label = switch (s.state) {
      PlanStepState.done when s.doneAt != null =>
        'مكتمل · ${formatHijriDayMonth(s.doneAt!)}',
      PlanStepState.done => 'مكتمل',
      PlanStepState.today => 'اليوم',
      PlanStepState.missed => 'فاته يوم — متاح الآن',
      PlanStepState.locked => s.tomorrow ? 'يُفتح غدًا' : 'مقفل',
    };
    final ink = switch (s.state) {
      PlanStepState.done => AppColors.deepGreen,
      PlanStepState.today => AppColors.primary,
      PlanStepState.missed => AppColors.warningText,
      PlanStepState.locked => AppColors.textMuted,
    };
    final bg = switch (s.state) {
      PlanStepState.today => AppColors.greenTint,
      PlanStepState.missed => AppColors.goldTint,
      _ => null,
    };
    return Semantics(
      container: true,
      selected:
          s.state == PlanStepState.today || s.state == PlanStepState.missed,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // the dot, and the line down to the next step (green once done)
            SizedBox(
              width: _dot + 20,
              child: Column(
                children: [
                  const SizedBox(height: 10),
                  _Dot(state: s.state),
                  if (!last)
                    Expanded(
                      child: Container(
                        width: 3,
                        margin: const EdgeInsets.symmetric(vertical: 3),
                        decoration: BoxDecoration(
                          color: s.state == PlanStepState.done
                              ? AppColors.primary
                              : AppColors.border,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              child: Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: bg,
                  borderRadius: BorderRadius.circular(AppRadii.row),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(s.step.title, style: AppTextStyles.itemTitle),
                    const SizedBox(height: 2),
                    Text(s.step.detail, style: AppTextStyles.caption),
                    const SizedBox(height: 2),
                    Text(
                      label,
                      style: AppTextStyles.caption.copyWith(
                        color: ink,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.state});

  final PlanStepState state;

  @override
  Widget build(BuildContext context) {
    const size = _StepRow._dot;
    return switch (state) {
      PlanStepState.done => Container(
        width: size,
        height: size,
        decoration: const BoxDecoration(
          color: AppColors.primary,
          shape: BoxShape.circle,
        ),
        child: const Icon(
          Icons.check_rounded,
          color: AppColors.surface,
          size: 20,
        ),
      ),
      PlanStepState.today => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: AppColors.surface,
          shape: BoxShape.circle,
          border: Border.all(color: AppColors.primary, width: 2.5),
        ),
        child: const Center(child: _PulsingDot()),
      ),
      PlanStepState.missed => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: AppColors.surface,
          shape: BoxShape.circle,
          border: Border.all(color: AppColors.gold, width: 2),
        ),
        child: Center(
          child: Text(
            '!',
            style: AppTextStyles.itemTitle.copyWith(
              color: AppColors.warningText,
            ),
          ),
        ),
      ),
      PlanStepState.locked => Container(
        width: size,
        height: size,
        decoration: const BoxDecoration(
          color: AppColors.borderSoft,
          shape: BoxShape.circle,
        ),
        child: const Icon(
          Icons.lock_rounded,
          color: AppColors.stageOffStem,
          size: 16,
        ),
      ),
    };
  }
}

/// The «اليوم» dot breathes (still when the system asks for no animations).
class _PulsingDot extends StatefulWidget {
  const _PulsingDot();

  @override
  State<_PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<_PulsingDot>
    with SingleTickerProviderStateMixin {
  late final _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.of(context).disableAnimations) {
      _c.stop();
    } else if (!_c.isAnimating) {
      _c.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ScaleTransition(
    scale: Tween(begin: 0.75, end: 1.15).animate(_c),
    child: Container(
      width: 12,
      height: 12,
      decoration: const BoxDecoration(
        color: AppColors.primary,
        shape: BoxShape.circle,
      ),
    ),
  );
}
