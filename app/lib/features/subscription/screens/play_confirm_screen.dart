import 'package:flutter/material.dart';

import '../../../core/app_scope.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/app_icons.dart';
import '../../auth/data/auth_failure.dart';
import '../data/subscription.dart';

/// Frame 06 — Google-Play-style purchase confirmation (no card entry, ever).
/// Returns true when the (mock) purchase succeeded.
///
/// TODO(phase-c): with real Google Play Billing this sheet is drawn by the Play
/// system UI itself; keep only the call to [SubscriptionRepository.purchase].
Future<bool> showPlayConfirmSheet(
  BuildContext context,
  SubscriptionPlan plan,
) async {
  final ok = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    barrierColor: AppColors.scrim,
    backgroundColor: Colors.transparent,
    elevation: 0,
    builder: (_) => PlayConfirmSheet(plan: plan),
  );
  return ok ?? false;
}

class PlayConfirmSheet extends StatefulWidget {
  const PlayConfirmSheet({super.key, required this.plan});

  final SubscriptionPlan plan;

  @override
  State<PlayConfirmSheet> createState() => _PlayConfirmSheetState();
}

class _PlayConfirmSheetState extends State<PlayConfirmSheet> {
  bool _busy = false;

  bool get _annual => widget.plan == SubscriptionPlan.annual;

  Future<void> _subscribe() async {
    setState(() => _busy = true);
    final nav = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await AppScope.of(context).subscriptions.purchase(widget.plan);
      nav.pop(true);
    } on AuthFailure catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final email = AppScope.of(context).auth.currentUser?.email;
    final period = _annual ? 'سنة' : 'شهر';
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppRadii.sheet),
        ),
        boxShadow: AppShadows.sheet,
      ),
      padding: EdgeInsets.fromLTRB(
        22,
        12,
        22,
        26 + MediaQuery.paddingOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: AppSizes.sheetHandleWidth,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.playOutline,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Container(
                width: AppSizes.playChip,
                height: AppSizes.playChip,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.playChip,
                  borderRadius: BorderRadius.circular(AppRadii.playChip),
                ),
                child: AppIcon.playSystem(),
              ),
              const SizedBox(width: 10),
              Text(
                'Google Play',
                textDirection: TextDirection.ltr,
                style: AppTextStyles.playText(14, weight: FontWeight.w700),
              ),
              const Spacer(),
              Text(
                'شاشة النظام',
                style: AppTextStyles.playText(
                  12,
                  color: AppColors.playTextMuted,
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          const Divider(height: 1, thickness: 1, color: AppColors.playDivider),
          const SizedBox(height: 18),
          Row(
            children: [
              Container(
                width: AppSizes.playAppIcon,
                height: AppSizes.playAppIcon,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.greenTint,
                  borderRadius: BorderRadius.circular(AppRadii.playAppIcon),
                ),
                child: AppIcon.sproutBare(),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'غَرْسة — الباقة ${_annual ? 'السنوية' : 'الشهرية'}',
                      style: AppTextStyles.playText(
                        16,
                        weight: FontWeight.w700,
                        color: AppColors.playTextStrong,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'اشتراك يتجدد تلقائيًا كل $period',
                      style: AppTextStyles.playText(
                        13,
                        color: AppColors.playTextMuted,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.playSurface,
              borderRadius: BorderRadius.circular(AppRadii.playPanel),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('السعر', style: AppTextStyles.playText(14)),
                    Text.rich(
                      TextSpan(
                        text: _annual ? '١١٩٫٠٠ ر.س. ' : '٢٩٫٠٠ ر.س. ',
                        style: AppTextStyles.playText(
                          20,
                          weight: FontWeight.w800,
                          color: AppColors.playTextStrong,
                        ),
                        children: [
                          TextSpan(
                            text: '/ $period',
                            style: AppTextStyles.playText(
                              13,
                              weight: FontWeight.w500,
                              color: AppColors.playTextMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                const Divider(
                  height: 1,
                  thickness: 1,
                  color: AppColors.playDivider,
                ),
                const SizedBox(height: 12),
                _row('الحساب', email ?? '[بريد حسابك في Google]', ltr: true),
                const SizedBox(height: 12),
                _row('طريقة الدفع', 'المحفوظة في Google Play'),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Text(
            'يبدأ الاشتراك فورًا ويتجدد تلقائيًا كل $period حتى تلغيه. يمكن الإلغاء في أي وقت من إعدادات الاشتراكات في Google Play قبل ٢٤ ساعة من موعد التجديد.',
            style: AppTextStyles.playText(
              12,
              color: AppColors.playTextMuted,
              height: 1.8,
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              OutlinedButton(
                onPressed: _busy
                    ? null
                    : () => Navigator.of(context).pop(false),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(0, AppSizes.playButtonHeight),
                  padding: const EdgeInsets.symmetric(horizontal: 22),
                  foregroundColor: AppColors.playText,
                  side: const BorderSide(color: AppColors.playOutline),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadii.playButton),
                  ),
                  textStyle: AppTextStyles.playText(
                    15,
                    weight: FontWeight.w700,
                  ),
                ),
                child: const Text('إلغاء'),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  onPressed: _busy ? null : _subscribe,
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(
                      AppSizes.playButtonHeight,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadii.playButton),
                    ),
                    textStyle: AppTextStyles.buttonMedium,
                  ),
                  child: _busy
                      ? const SizedBox.square(
                          dimension: AppSizes.iconLg,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.4,
                            color: AppColors.surface,
                          ),
                        )
                      : const Text('اشتراك'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _row(String label, String value, {bool ltr = false}) {
    return Row(
      children: [
        Text(label, style: AppTextStyles.playText(14)),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            value,
            // Values sit on the visual left (the row's end in RTL), LTR or not.
            textAlign: TextAlign.left,
            textDirection: ltr ? TextDirection.ltr : null,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.playText(13.5, color: AppColors.playTextMuted),
          ),
        ),
      ],
    );
  }
}
