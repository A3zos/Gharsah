import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/app_scope.dart';
import '../../../core/arabic_digits.dart';
import '../../auth/data/auth_failure.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/app_icons.dart';
import '../../../widgets/confirm_sheet.dart';
import '../../../widgets/decor_blob.dart';
import '../../../widgets/info_note.dart';
import '../../../widgets/screen_frame.dart';
import '../data/child_profile.dart';
import 'add_child_screen.dart';

/// Frame 11 — «تمت إضافة …» with the child's 6-digit pairing code, issued by
/// the server (Cloud Function `createPairingCode`, valid 24 h). Follows the
/// child document live, and «إصدار رمز جديد» revokes the old code, unlinks
/// the child's device and issues a new one (`revokePairingCode`).
class PairingCodeScreen extends StatefulWidget {
  const PairingCodeScreen({super.key, required this.child});

  final ChildProfile child;

  @override
  State<PairingCodeScreen> createState() => _PairingCodeScreenState();
}

class _PairingCodeScreenState extends State<PairingCodeScreen>
    with SingleTickerProviderStateMixin {
  // Design keyframe gh-pop: scale .86 → 1 with fade, 0.6s.
  late final AnimationController _pop = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 600),
  )..forward();

  late ChildProfile _child = widget.child;
  StreamSubscription<ChildProfile?>? _sub;
  bool _busy = false;

  String get _code => _child.pairingCode.arabicDigits;
  bool get _active => _child.pairing?.isActive(DateTime.now()) ?? false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sub ??= AppScope.of(context).children
        .watchChild(widget.child.id)
        .listen((c) {
          if (c != null && mounted) setState(() => _child = c);
        });
  }

  @override
  void dispose() {
    _sub?.cancel();
    _pop.dispose();
    super.dispose();
  }

  Future<void> _newCode() async {
    final ok = await showConfirmSheet(
      context,
      title: 'إصدار رمز جديد',
      message: _child.linked
          ? 'سيتوقف الرمز الحالي، ويُفصل جهاز ${_child.name} المرتبط حتى يُدخل الرمز الجديد.'
          : 'سيتوقف الرمز الحالي ولن يعمل بعد الآن.',
      confirmLabel: 'إصدار رمز جديد',
    );
    if (!ok || !mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    try {
      final p = await AppScope.of(context).pairing.revokeAndReissue(_child.id);
      if (mounted) setState(() => _child = _child.withPairing(p));
    } on AuthFailure catch (e) {
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _copy() async {
    final messenger = ScaffoldMessenger.of(context);
    await Clipboard.setData(ClipboardData(text: _code));
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(const SnackBar(content: Text('نُسخ الرمز.')));
  }

  void _share() => SharePlus.instance.share(
    ShareParams(text: 'رمز الربط لتطبيق غَرْسة للأطفال: $_code'),
  );

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final pop = CurvedAnimation(parent: _pop, curve: Curves.ease);
    return ScreenFrame(
      padding: const EdgeInsets.fromLTRB(24, 44, 24, 30),
      blobs: [
        DecorBlob(
          top: -170,
          right: -140,
          size: 400,
          color: AppColors.blobGreenStrong,
        ),
      ],
      child: TopBottom(
        minGap: 20,
        top: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: FadeTransition(
                opacity: pop,
                child: ScaleTransition(
                  scale: Tween(begin: 0.86, end: 1.0).animate(pop),
                  // The design's inline SVG sits in a 112px line box (104 + 8),
                  // and the ✓ badge is placed against that box.
                  child: SizedBox(
                    width: AppSizes.treeMark,
                    height: AppSizes.treeMark + 8,
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        AppIcon.treeMark(),
                        Positioned(
                          bottom: 2,
                          left: 0,
                          child: Container(
                            width: AppSizes.successBadge,
                            height: AppSizes.successBadge,
                            alignment: Alignment.center,
                            decoration: const BoxDecoration(
                              color: AppColors.deepGreen,
                              shape: BoxShape.circle,
                            ),
                            child: AppIcon.tick(size: 19, stroke: 3.2),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'تمت إضافة ${_child.name}',
              style: t.headlineMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 280),
                child: Text(
                  'أعطِ هذا الرمز لطفلك ليدخل به في تطبيق غَرْسة للأطفال.',
                  style: AppTextStyles.subtitle.copyWith(height: 1.8),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 24),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(AppRadii.card),
                boxShadow: AppShadows.pairingCard,
              ),
              child: Column(
                children: [
                  Text('رمز الربط', style: AppTextStyles.priceUnit),
                  const SizedBox(height: 16),
                  Semantics(
                    label: 'رمز الربط: ${_code.split('').join(' ')}',
                    excludeSemantics: true,
                    child: Directionality(
                      // Codes read left-to-right, as in the design.
                      textDirection: TextDirection.ltr,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          for (var i = 0; i < _code.length; i++) ...[
                            if (i > 0) const SizedBox(width: 8),
                            _CodeCell(digit: _code[i], gold: i >= 3),
                          ],
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _active ? _copy : null,
                          icon: AppIcon.copy(),
                          label: const Text('انسخ'),
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size.fromHeight(
                              AppSizes.actionButtonHeight,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(
                                AppRadii.actionButton,
                              ),
                            ),
                            textStyle: AppTextStyles.actionLabel,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: _active ? _share : null,
                          icon: AppIcon.share(),
                          label: const Text('شارك'),
                          style: FilledButton.styleFrom(
                            minimumSize: const Size.fromHeight(
                              AppSizes.actionButtonHeight,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(
                                AppRadii.actionButton,
                              ),
                            ),
                            textStyle: AppTextStyles.actionLabel,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            if (!_active) ...[
              const SizedBox(height: 12),
              // TODO(design): no designed expired / already-linked state.
              InfoNote(
                tone: InfoNoteTone.gold,
                lineHeight: 1.8,
                text: _child.linked
                    ? 'استخدم ${_child.name} هذا الرمز وارتبط جهازه. لربط جهاز آخر أصدر رمزًا جديدًا.'
                    : 'انتهت صلاحية هذا الرمز (يصلح ٢٤ ساعة) — أصدر رمزًا جديدًا.',
              ),
            ],
            const SizedBox(height: 4),
            Center(
              child: TextButton(
                onPressed: _busy ? null : _newCode,
                child: _busy
                    ? const SizedBox.square(
                        dimension: AppSizes.iconLg,
                        child: CircularProgressIndicator(strokeWidth: 2.4),
                      )
                    : Text('إصدار رمز جديد', style: AppTextStyles.linkSmall),
              ),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
              decoration: BoxDecoration(
                color: AppColors.borderSoft,
                borderRadius: BorderRadius.circular(AppRadii.noteCard),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: AppIcon.shieldGold(),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'لا ينشئ طفلك حسابًا ولا يُدخل بريدًا أو كلمة مرور — الرمز وحده يربط تطبيقه بحسابك. تجده دائمًا في بطاقة الابن داخل تبويب الباقات.',
                      style: t.bodySmall!.copyWith(
                        color: AppColors.onGold,
                        height: 1.85,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        bottom: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            FilledButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('تم — العودة إلى الباقات'),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => Navigator.of(context).pushReplacement(
                MaterialPageRoute<void>(builder: (_) => const AddChildScreen()),
              ),
              style: TextButton.styleFrom(
                minimumSize: const Size.fromHeight(
                  AppSizes.secondaryButtonHeight,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadii.actionButton),
                ),
                textStyle: AppTextStyles.optionLabel,
              ),
              child: const Text('إضافة ابن آخر'),
            ),
          ],
        ),
      ),
    );
  }
}

class _CodeCell extends StatelessWidget {
  const _CodeCell({required this.digit, required this.gold});

  final String digit;
  final bool gold;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: AppSizes.pairingCellWidth,
      height: AppSizes.pairingCellHeight,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: gold ? AppColors.goldTint : AppColors.greenTint,
        borderRadius: BorderRadius.circular(AppRadii.pairingCell),
        border: Border.all(
          color: gold ? AppColors.goldBorder : AppColors.mintBorder,
          width: AppSizes.borderWidth,
        ),
      ),
      child: Text(
        digit,
        style: AppTextStyles.pairingDigit.copyWith(
          color: gold ? AppColors.warningText : AppColors.deepGreen,
        ),
      ),
    );
  }
}
