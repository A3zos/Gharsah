import 'package:flutter/material.dart';

import '../../../core/arabic_digits.dart';
import '../../../core/time_format.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/app_icons.dart';
import '../../../widgets/g_back_button.dart';
import '../../../widgets/info_note.dart';
import '../../../widgets/screen_frame.dart';
import '../data/child_profile.dart';
import '../widgets/add_child_stepper.dart';
import 'avatar_picker_screen.dart';

/// Frames 08 + 09 — «جدول التعلّم». One screen: «تخصيص وقت لكل يوم» is
/// collapsed by default (08) and expands in place (09). Android back
/// collapses it before leaving the screen.
class ScheduleScreen extends StatefulWidget {
  const ScheduleScreen({
    super.key,
    required this.draft,
    this.debugExpanded = false,
  });

  final ChildDraft draft;

  /// Design previews only: start with the per-day section open (frame 09).
  final bool debugExpanded;

  @override
  State<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends State<ScheduleScreen> {
  late final Set<WeekDay> _days = {...widget.draft.schedule.days};
  late int _time = widget.draft.schedule.time;
  late int _duration = widget.draft.schedule.duration;

  /// Per-day offsets from the default time, as in the design: tapping a
  /// day's time adds 15 minutes, cycling within two hours.
  final Map<WeekDay, int> _offsets = {};
  late bool _customOpen = widget.debugExpanded;

  String get _countText => switch (_days.length) {
    0 => 'لم تختر أيامًا بعد',
    1 => 'يوم واحد مختار',
    2 => 'يومان مختاران',
    final n => '${n.arabicDigits} أيام مختارة',
  };

  void _next() {
    final schedule = ChildSchedule(
      days: _days,
      time: _time,
      custom: {
        for (final e in _offsets.entries)
          if (e.value != 0 && _days.contains(e.key))
            e.key: (_time + e.value) % 1440,
      },
      duration: _duration,
    );
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => AvatarPickerScreen(
          draft: widget.draft.copyWith(schedule: schedule),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return PopScope(
      canPop: !_customOpen,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) setState(() => _customOpen = false);
      },
      child: ScreenFrame(
        padding: const EdgeInsets.fromLTRB(
          AppSizes.pagePaddingH,
          30,
          AppSizes.pagePaddingH,
          30,
        ),
        child: TopBottom(
          minGap: 18,
          top: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const GBackButton(),
                  const SizedBox(width: 12),
                  Text('جدول التعلّم', style: AppTextStyles.pageTitleSmall),
                ],
              ),
              const SizedBox(height: 18),
              const AddChildStepper(current: 1),
              const SizedBox(height: 18),
              Text(
                'حدّد أيام الحصص ووقتها — ونذكّر طفلك تلقائيًا.',
                style: AppTextStyles.intro,
              ),
              const SizedBox(height: 18),
              _header(t, 'أيام الحصص', _countText),
              // 46px circles in 48px tap targets: take 1px from each gap.
              const SizedBox(height: 11 - 1),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  for (final d in WeekDay.values)
                    _DayToggle(
                      day: d,
                      on: _days.contains(d),
                      onTap: () => setState(() {
                        _days.contains(d) ? _days.remove(d) : _days.add(d);
                      }),
                    ),
                ],
              ),
              const SizedBox(height: 18 - 1),
              _header(
                t,
                'وقت الحصة',
                _customOpen
                    ? 'الوقت الافتراضي'
                    : 'يُطبَّق على كل الأيام المختارة',
              ),
              const SizedBox(height: 10),
              _TimeCard(
                time: _time,
                onMinus: () => setState(() => _time = (_time + 1425) % 1440),
                onPlus: () => setState(() => _time = (_time + 15) % 1440),
              ),
              const SizedBox(height: 10),
              _CustomToggle(
                open: _customOpen,
                onTap: () => setState(() => _customOpen = !_customOpen),
              ),
              if (_customOpen)
                _CustomBody(
                  rows: [
                    for (final d in WeekDay.values)
                      if (_days.contains(d)) (d, _time + (_offsets[d] ?? 0)),
                  ],
                  onBump: (d) => setState(() {
                    _offsets[d] = ((_offsets[d] ?? 0) + 15) % 120;
                  }),
                ),
              const SizedBox(height: 18),
              Text('الحدّ الأقصى للحصة اليومية', style: t.labelLarge),
              const SizedBox(height: 10),
              Row(
                children: [
                  for (final n in ChildSchedule.durations) ...[
                    if (n != ChildSchedule.durations.first)
                      const SizedBox(width: 10),
                    Expanded(
                      child: _Choice(
                        label: '${n.arabicDigits} دقيقة',
                        selected: _duration == n,
                        onTap: () => setState(() => _duration = n),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 10),
              Text(
                'الحصة تنتهي متى أنهى طفلُك دروس اليوم، دون تجاوز هذه المدة.',
                style: AppTextStyles.caption.copyWith(height: 1.8),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  AppIcon.bell(),
                  const SizedBox(width: 9),
                  Text(
                    'سنذكّر طفلك قبل موعد الحصة',
                    style: AppTextStyles.caption,
                  ),
                ],
              ),
              const SizedBox(height: 18),
              const InfoNote(
                tone: InfoNoteTone.greenInfo,
                lineHeight: 1.8,
                text: 'يمكنك تعديل الجدول لاحقًا من لوحة التحكم في أي وقت.',
              ),
            ],
          ),
          bottom: FilledButton(
            // At least one lesson day is needed; the design's count line says so.
            onPressed: _days.isEmpty ? null : _next,
            child: const Text('التالي — اختيار الشخصية'),
          ),
        ),
      ),
    );
  }

  Widget _header(TextTheme t, String title, String trailing) => Row(
    crossAxisAlignment: CrossAxisAlignment.baseline,
    textBaseline: TextBaseline.alphabetic,
    mainAxisAlignment: MainAxisAlignment.spaceBetween,
    children: [
      Text(title, style: t.labelLarge),
      const SizedBox(width: 10),
      Flexible(child: Text(trailing, style: AppTextStyles.caption)),
    ],
  );
}

class _DayToggle extends StatelessWidget {
  const _DayToggle({required this.day, required this.on, required this.onTap});

  final WeekDay day;
  final bool on;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      toggled: on,
      label: day.label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: SizedBox.square(
          dimension: AppSizes.minTouch,
          child: Center(
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              width: AppSizes.dayCircle,
              height: AppSizes.dayCircle,
              decoration: BoxDecoration(
                color: on ? AppColors.deepGreen : AppColors.surface,
                shape: BoxShape.circle,
                border: Border.all(
                  color: on ? AppColors.deepGreen : AppColors.inputBorder,
                  width: on
                      ? AppSizes.selectedBorderWidth
                      : AppSizes.borderWidth,
                ),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (on) AppIcon.tick(size: 11),
                  Text(
                    day.short,
                    style: AppTextStyles.dayShort.copyWith(
                      color: on ? AppColors.surface : AppColors.textDark,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// 44px square button (design) inside a 48px tap target.
class _SmallSquareButton extends StatelessWidget {
  const _SmallSquareButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final Widget icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: SizedBox.square(
          dimension: AppSizes.minTouch,
          child: Center(
            child: Container(
              width: AppSizes.smallButton,
              height: AppSizes.smallButton,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(AppRadii.smallButton),
                border: Border.all(
                  color: AppColors.inputBorder,
                  width: AppSizes.borderWidth,
                ),
              ),
              child: icon,
            ),
          ),
        ),
      ),
    );
  }
}

class _TimeCard extends StatelessWidget {
  const _TimeCard({
    required this.time,
    required this.onMinus,
    required this.onPlus,
  });

  final int time;
  final VoidCallback onMinus;
  final VoidCallback onPlus;

  @override
  Widget build(BuildContext context) {
    const extra = (AppSizes.minTouch - AppSizes.smallButton) / 2;
    return Container(
      // Design padding 12/14; the buttons' 48px targets use 2px of it.
      padding: const EdgeInsetsDirectional.fromSTEB(
        14,
        12 - extra,
        14 - extra,
        12 - extra,
      ),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.timeCard),
        border: Border.all(
          color: AppColors.border,
          width: AppSizes.borderWidth,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: AppSizes.smallButton,
            height: AppSizes.smallButton,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.greenTint,
              borderRadius: BorderRadius.circular(AppRadii.smallButton),
            ),
            child: AppIcon.clock(),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Semantics(
              liveRegion: true,
              child: Text(formatTime(time), style: AppTextStyles.timeBig),
            ),
          ),
          const SizedBox(width: 12 - extra),
          _SmallSquareButton(
            icon: AppIcon.minus(),
            label: 'تقديم الوقت ربع ساعة',
            onTap: onMinus,
          ),
          const SizedBox(width: 8 - 2 * extra),
          _SmallSquareButton(
            icon: AppIcon.plusDark(),
            label: 'تأخير الوقت ربع ساعة',
            onTap: onPlus,
          ),
        ],
      ),
    );
  }
}

class _CustomToggle extends StatelessWidget {
  const _CustomToggle({required this.open, required this.onTap});

  final bool open;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final radius = open
        ? const BorderRadius.vertical(top: Radius.circular(AppRadii.toggle))
        : BorderRadius.circular(AppRadii.toggle);
    final side = BorderSide(
      color: open ? AppColors.mintBorder : AppColors.border,
      width: AppSizes.borderWidth,
    );
    return Semantics(
      button: true,
      expanded: open,
      child: Material(
        color: open ? AppColors.greenTint : Colors.transparent,
        shape: open
            ? RoundedRectangleBorder(borderRadius: radius, side: side)
            : RoundedRectangleBorder(borderRadius: radius, side: side),
        child: InkWell(
          onTap: onTap,
          customBorder: RoundedRectangleBorder(borderRadius: radius),
          child: Container(
            height: AppSizes.toggleHeight,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                AppIcon.lines(),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'تخصيص وقت لكل يوم',
                        style: Theme.of(context).textTheme.labelLarge!
                            .copyWith(color: AppColors.deepGreen),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        open
                            ? 'مُفعّل — اضغط للإخفاء'
                            : 'اختياري — لأوقات مختلفة بين الأيام',
                        style: AppTextStyles.tiny,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                open
                    ? AppIcon.chevronUp(
                        size: AppSizes.iconMd,
                        color: AppColors.deepGreen,
                      )
                    : AppIcon.chevronDown(
                        size: AppSizes.iconMd,
                        color: AppColors.textMuted,
                      ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CustomBody extends StatelessWidget {
  const _CustomBody({required this.rows, required this.onBump});

  final List<(WeekDay, int)> rows;
  final ValueChanged<WeekDay> onBump;

  @override
  Widget build(BuildContext context) {
    const extra = (AppSizes.minTouch - AppSizes.smallButton) / 2;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 4, 14, 16),
      decoration: const BoxDecoration(
        color: AppColors.greenTint,
        borderRadius: BorderRadius.vertical(
          bottom: Radius.circular(AppRadii.toggle),
        ),
        border: Border(
          left: BorderSide(
            color: AppColors.mintBorder,
            width: AppSizes.borderWidth,
          ),
          right: BorderSide(
            color: AppColors.mintBorder,
            width: AppSizes.borderWidth,
          ),
          bottom: BorderSide(
            color: AppColors.mintBorder,
            width: AppSizes.borderWidth,
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'يُستخدم الوقت الافتراضي أعلاه لأي يوم لم تغيّره.',
            style: AppTextStyles.tiny.copyWith(height: 1.8),
          ),
          const SizedBox(height: 4),
          for (final (day, time) in rows) ...[
            const SizedBox(height: 8),
            Container(
              // Design padding 7/8 around a 44px pill; the 48px target uses 2px.
              padding: const EdgeInsets.symmetric(
                horizontal: 8,
                vertical: 7 - extra,
              ),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(AppRadii.dayRow),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsetsDirectional.only(start: 8),
                      child: Text(
                        day.label,
                        style: Theme.of(context).textTheme.labelLarge,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Semantics(
                    button: true,
                    label:
                        'تأخير وقت ${day.label} ربع ساعة، الآن ${formatTime(time)}',
                    excludeSemantics: true,
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => onBump(day),
                      child: SizedBox(
                        height: AppSizes.minTouch,
                        child: Center(
                          child: Container(
                            height: AppSizes.smallButton,
                            padding: const EdgeInsets.symmetric(horizontal: 14),
                            decoration: BoxDecoration(
                              color: AppColors.background,
                              borderRadius: BorderRadius.circular(
                                AppRadii.timePill,
                              ),
                              border: Border.all(
                                color: AppColors.mintBorder,
                                width: AppSizes.borderWidth,
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                AppIcon.clock(size: 17),
                                const SizedBox(width: 7),
                                Text(
                                  formatTime(time),
                                  style: AppTextStyles.chipLabel.copyWith(
                                    color: AppColors.deepGreen,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Duration choice (٣٠ / ٤٥ / ٦٠ دقيقة).
class _Choice extends StatelessWidget {
  const _Choice({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      excludeSemantics: true,
      child: Material(
        color: selected ? AppColors.greenTint : AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.toggle),
          side: BorderSide(
            color: selected ? AppColors.deepGreen : AppColors.inputBorder,
            width: selected
                ? AppSizes.selectedBorderWidth
                : AppSizes.borderWidth,
          ),
        ),
        child: InkWell(
          onTap: onTap,
          customBorder: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.toggle),
          ),
          child: SizedBox(
            height: AppSizes.durationHeight,
            child: Center(
              child: Text(
                label,
                style: AppTextStyles.optionLabel.copyWith(
                  color: selected ? AppColors.deepGreen : AppColors.textDark,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
