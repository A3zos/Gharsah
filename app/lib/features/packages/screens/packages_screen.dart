import 'package:flutter/material.dart';

import '../../../core/app_scope.dart';
import '../../../core/arabic_digits.dart';
import '../../../core/mock_data.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/app_icons.dart';
import '../../../widgets/child_avatar.dart';
import '../../../widgets/g_page_header.dart';
import '../../children/data/child_profile.dart';
import '../../children/screens/pairing_code_screen.dart';
import '../../subscription/data/subscription.dart';

const String _googlePlay = 'Google Play';

/// Frame 05 — «الباقات» tab: current plan, plan options, add child, children.
class PackagesScreen extends StatelessWidget {
  const PackagesScreen({
    super.key,
    required this.onBuy,
    required this.onAddChild,
    required this.onAchievements,
    required this.onSettings,
  });

  final ValueChanged<SubscriptionPlan> onBuy;
  final VoidCallback onAddChild;
  final ValueChanged<ChildProfile> onAchievements;
  final VoidCallback onSettings;

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    return StreamBuilder<List<ChildProfile>>(
      stream: scope.children.watchChildren(),
      builder: (context, kids) => StreamBuilder<Subscription?>(
        stream: scope.subscriptions.watchCurrent(),
        builder: (context, snap) {
          final sub = snap.data;
          final children = kids.data ?? const <ChildProfile>[];
          return ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSizes.pagePaddingH,
              30 - GPageHeader.targetExtra,
              AppSizes.pagePaddingH,
              22,
            ),
            children: [
              GPageHeader(
                title: 'الباقات',
                showLogo: true,
                onSettings: onSettings,
              ),
              const SizedBox(height: 22 - GPageHeader.targetExtra),
              _CurrentPlanCard(
                subscription: sub,
                onRenew: () => onBuy(sub?.plan ?? MockData.plan.plan),
              ),
              const SizedBox(height: 22),
              _SectionHeader(
                title: 'تغيير الباقة',
                trailing: 'الدفع عبر $_googlePlay',
              ),
              const SizedBox(height: 14),
              _AnnualPlanCard(
                onSubscribe: () => onBuy(SubscriptionPlan.annual),
              ),
              const SizedBox(height: 14),
              _MonthlyPlanCard(
                onSubscribe: () => onBuy(SubscriptionPlan.monthly),
              ),
              const SizedBox(height: 22),
              _AddChildButton(onPressed: onAddChild),
              const SizedBox(height: 22),
              _SectionHeader(
                title: 'أبنائي',
                trailing: '${children.length.arabicDigits} من الأبناء',
              ),
              for (final child in children) ...[
                const SizedBox(height: 12),
                _ChildCard(
                  child: child,
                  onAchievements: () => onAchievements(child),
                ),
              ],
              const SizedBox(height: 22),
              const _PlayNote(),
            ],
          );
        },
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, required this.trailing});

  final String title;
  final String trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(title, style: AppTextStyles.sectionTitle),
        Text(trailing, style: AppTextStyles.caption),
      ],
    );
  }
}

class _CurrentPlanCard extends StatelessWidget {
  const _CurrentPlanCard({required this.subscription, required this.onRenew});

  final Subscription? subscription;
  final VoidCallback onRenew;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final sub = subscription;
    // TODO(phase-c): a designed "no subscription yet" state replaces the sample plan.
    final sample = MockData.plan;
    final plan = sub?.plan ?? sample.plan;
    final daysLeft = sub?.daysLeft(now) ?? sample.daysLeft;
    final fraction = sub?.remainingFraction(now) ?? sample.remainingFraction;
    final ends = sub == null
        ? sample.expiresOn
        : (
            day: sub.expiresAt.day,
            month: sub.expiresAt.month,
            year: sub.expiresAt.year,
          );
    String two(int n) => n.toString().padLeft(2, '0').arabicDigits;
    final endsText =
        '${two(ends.day)} / ${two(ends.month)} / ${ends.year.arabicDigits}';
    final muted = AppColors.onDeepGreenMuted;

    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadii.card),
      child: Container(
        color: AppColors.deepGreen,
        child: Stack(
          children: [
            Positioned(
              top: -40,
              left: -30,
              width: 150,
              height: 150,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: AppColors.heroCircle,
                  shape: BoxShape.circle,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Flexible(
                        child: Text(
                          'باقتك الحالية — ${plan.label}',
                          style: AppTextStyles.cardTitle.copyWith(
                            color: AppColors.surface,
                          ),
                        ),
                      ),
                      const _Pill(text: 'نشطة', vertical: 5, horizontal: 12),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(
                        daysLeft.arabicDigits,
                        style: AppTextStyles.heroNumber,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'يومًا متبقية',
                        style: Theme.of(context).textTheme.bodyLarge!.copyWith(
                          color: muted,
                          fontWeight: FontWeight.w500,
                          height: AppFonts.cairoNormal,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Semantics(
                    label: 'المتبقي من الباقة',
                    value: '${(fraction * 100).round().arabicDigits}٪',
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(AppRadii.progress),
                      child: SizedBox(
                        height: AppSizes.progressHeight,
                        child: Stack(
                          children: [
                            Positioned.fill(
                              child: ColoredBox(color: AppColors.heroTrack),
                            ),
                            FractionallySizedBox(
                              alignment: AlignmentDirectional.centerStart,
                              widthFactor: fraction,
                              heightFactor: 1,
                              child: DecoratedBox(
                                decoration: BoxDecoration(
                                  color: AppColors.gold,
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
                  Text(
                    'تنتهي في $endsText — ثم تتجدد تلقائيًا عبر $_googlePlay',
                    style: AppTextStyles.caption.copyWith(color: muted),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: onRenew,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.gold,
                      foregroundColor: AppColors.onGold,
                      minimumSize: const Size.fromHeight(
                        AppSizes.renewButtonHeight,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(
                          AppRadii.renewButton,
                        ),
                      ),
                      textStyle: AppTextStyles.buttonMedium.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    child: const Text('تجديد الباقة'),
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

class _Pill extends StatelessWidget {
  const _Pill({
    required this.text,
    required this.vertical,
    required this.horizontal,
  });

  final String text;
  final double vertical;
  final double horizontal;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: horizontal, vertical: vertical),
      decoration: BoxDecoration(
        color: AppColors.gold,
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Text(text, style: AppTextStyles.chip),
    );
  }
}

class _AnnualPlanCard extends StatelessWidget {
  const _AnnualPlanCard({required this.onSubscribe});

  final VoidCallback onSubscribe;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(18, 22, 18, 18),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppRadii.planCard),
            border: Border.all(color: AppColors.primary, width: 2),
            boxShadow: AppShadows.planCard,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Flexible(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('سنوية', style: AppTextStyles.cardTitle),
                        const SizedBox(height: 4),
                        Text(
                          '≈ ١٠ ريال شهريًا · وفّر ٦٦٪',
                          style: AppTextStyles.caption,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  _Price(amount: 119, unit: 'ريال / سنة', big: true),
                ],
              ),
              const SizedBox(height: 14),
              const _Feature('أبناء غير محدودين على الحساب'),
              const SizedBox(height: 9),
              const _Feature('تقارير الإنجازات الكاملة'),
              const SizedBox(height: 14),
              FilledButton(
                onPressed: onSubscribe,
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(
                    AppSizes.subscribeButtonHeight,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(
                      AppRadii.subscribeButton,
                    ),
                  ),
                  textStyle: AppTextStyles.buttonMedium,
                ),
                child: const Text('اشترك سنويًا'),
              ),
            ],
          ),
        ),
        const PositionedDirectional(
          top: -13,
          start: 20,
          child: _Pill(text: 'الأفضل قيمة', vertical: 6, horizontal: 14),
        ),
      ],
    );
  }
}

class _Price extends StatelessWidget {
  const _Price({required this.amount, required this.unit, required this.big});

  final int amount;
  final String unit;
  final bool big;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Text(
          amount.arabicDigits,
          style: big ? AppTextStyles.price : AppTextStyles.priceSmall,
        ),
        const SizedBox(width: 4),
        Text(
          unit,
          style: big
              ? AppTextStyles.priceUnit
              : AppTextStyles.caption.copyWith(fontWeight: FontWeight.w700),
        ),
      ],
    );
  }
}

class _Feature extends StatelessWidget {
  const _Feature(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        AppIcon.featureCheck(),
        const SizedBox(width: 9),
        Expanded(child: Text(text, style: AppTextStyles.body135)),
      ],
    );
  }
}

class _MonthlyPlanCard extends StatelessWidget {
  const _MonthlyPlanCard({required this.onSubscribe});

  final VoidCallback onSubscribe;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.planCard),
        border: Border.all(
          color: AppColors.border,
          width: AppSizes.borderWidth,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('شهرية', style: AppTextStyles.cardTitleSmall),
                const SizedBox(height: 4),
                _Price(amount: 29, unit: 'ريال / شهر', big: false),
              ],
            ),
          ),
          const SizedBox(width: 12),
          OutlinedButton(
            onPressed: onSubscribe,
            style: OutlinedButton.styleFrom(
              minimumSize: const Size(0, AppSizes.monthlyButtonHeight),
              padding: const EdgeInsets.symmetric(horizontal: 22),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppRadii.monthlyButton),
              ),
              textStyle: AppTextStyles.buttonSmall,
            ),
            child: const Text('اشترك'),
          ),
        ],
      ),
    );
  }
}

class _AddChildButton extends StatelessWidget {
  const _AddChildButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadii.input),
        boxShadow: AppShadows.greenButton,
      ),
      child: FilledButton.icon(
        onPressed: onPressed,
        icon: AppIcon.plus(),
        label: const Text('إضافة ابن'),
        style: FilledButton.styleFrom(iconAlignment: IconAlignment.start),
      ),
    );
  }
}

class _ChildCard extends StatelessWidget {
  const _ChildCard({required this.child, required this.onAchievements});

  final ChildProfile child;
  final VoidCallback onAchievements;

  static String ageLabel(int age) =>
      '${age.arabicDigits} ${age >= 3 && age <= 10 ? 'سنوات' : 'سنة'}';

  /// «رمز الربط ٤٧٢٩١٨» while the server-issued code is valid.
  /// TODO(design): no designed label for a linked child / an expired code.
  static String codeLabel(ChildProfile child, DateTime now) {
    final p = child.pairing;
    if (p != null && p.isActive(now)) {
      return 'رمز الربط ${p.code.arabicDigits}';
    }
    return child.linked ? 'مرتبط بجهاز طفلك' : 'رمز الربط منتهٍ';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.childCard),
        boxShadow: AppShadows.childCard,
      ),
      child: Row(
        children: [
          ChildAvatar(child.avatarId),
          const SizedBox(width: 13),
          Expanded(
            // TODO(design): the card opens frame 11 (code / «إصدار رمز جديد»).
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => PairingCodeScreen(child: child),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(child.name, style: AppTextStyles.childName),
                  const SizedBox(height: 3),
                  Text(
                    '${ageLabel(child.age)} · ${codeLabel(child, DateTime.now())}',
                    style: AppTextStyles.body13,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 13),
          // 44px pill (design) inside a 48px tap target; the card row is taller anyway.
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onAchievements,
            child: SizedBox(
              height: AppSizes.minTouch,
              child: Center(
                child: Container(
                  height: AppSizes.achievementsHeight,
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  decoration: BoxDecoration(
                    color: AppColors.greenTint,
                    borderRadius: BorderRadius.circular(AppRadii.headerButton),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'الإنجازات',
                        style: AppTextStyles.linkSmall.copyWith(
                          decoration: TextDecoration.none,
                        ),
                      ),
                      const SizedBox(width: 6),
                      AppIcon.chevronForward(),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PlayNote extends StatelessWidget {
  const _PlayNote();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      decoration: BoxDecoration(
        color: AppColors.borderSoft,
        borderRadius: BorderRadius.circular(AppRadii.infoNote),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: AppSizes.noteIconBox,
            height: AppSizes.noteIconBox,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(AppRadii.noteIconBox),
              border: Border.all(color: AppColors.borderStrong),
            ),
            child: AppIcon.play(),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'الاشتراك يُدار من $_googlePlay',
                  style: AppTextStyles.body135.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'لا نطلب بيانات بطاقة داخل التطبيق. يمكنك الإلغاء في أي وقت من إعدادات الاشتراكات في Play.',
                  style: AppTextStyles.caption.copyWith(height: 1.7),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
