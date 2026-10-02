import 'package:flutter/material.dart';

import '../../../core/app_scope.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/app_icons.dart';
import '../../../widgets/child_avatar.dart';
import '../../../widgets/g_back_button.dart';
import '../../../widgets/loading_label.dart';
import '../../../widgets/screen_frame.dart';
import '../../auth/data/auth_failure.dart';
import '../data/child_profile.dart';
import '../widgets/add_child_stepper.dart';
import 'pairing_code_screen.dart';

/// Frame 10 — «اختر شخصية …»: the four avatars of the child's gender. «حفظ وإنشاء رمز
/// الربط» saves the child (Supabase) and shows its pairing code (11).
class AvatarPickerScreen extends StatefulWidget {
  const AvatarPickerScreen({super.key, required this.draft});

  final ChildDraft draft;

  @override
  State<AvatarPickerScreen> createState() => _AvatarPickerScreenState();
}

class _AvatarPickerScreenState extends State<AvatarPickerScreen> {
  late final bool _girl = widget.draft.gender == ChildGender.girl;
  late String _picked = AvatarStyle.keyFor(widget.draft.avatarId, girl: _girl);
  bool _busy = false;
  String? _error;

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final nav = Navigator.of(context);
    try {
      final child = await AppScope.of(context).children
          .addChild(widget.draft.copyWith(avatarId: _picked));
      // Back from the code screen goes to Packages, never into the saved draft.
      nav.pushAndRemoveUntil(
        MaterialPageRoute<void>(
          builder: (_) => PairingCodeScreen(child: child),
        ),
        (r) => r.isFirst,
      );
    } on AuthFailure catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ScreenFrame(
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
                Flexible(
                  child: Text(
                    'اختر شخصية ${widget.draft.name}',
                    style: AppTextStyles.pageTitleSmall,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            const AddChildStepper(current: 2),
            const SizedBox(height: 18),
            Text(
              'شخصيات محتشمة ولطيفة — يراها طفلك في تطبيقه مع كل إنجاز.',
              style: AppTextStyles.intro,
            ),
            const SizedBox(height: 18),
            GridView(
              // Fixed 112px card height, as in the design.
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 4,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                mainAxisExtent: AppSizes.avatarCardHeight,
              ),
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              padding: EdgeInsets.zero,
              children: [
                for (final a in AvatarStyle.forGender(girl: _girl))
                  _AvatarCard(
                    style: a,
                    selected: a.key == _picked,
                    onTap: () => setState(() => _picked = a.key),
                  ),
              ],
            ),
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(AppRadii.noteCard),
                boxShadow: AppShadows.childCard,
              ),
              child: Row(
                children: [
                  AppIcon.sproutInline(),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'تنمو شجرة الشخصية كلما أتمّ طفلك حفظًا جديدًا.',
                      style: AppTextStyles.caption.copyWith(height: 1.8),
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
            if (_error != null) ...[
              Text(
                _error!,
                style: AppTextStyles.helper.copyWith(
                  color: AppColors.errorText,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),
            ],
            FilledButton(
              onPressed: _busy ? null : _save,
              child: LoadingLabel(
                loading: _busy,
                label: 'حفظ وإنشاء رمز الربط',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AvatarCard extends StatelessWidget {
  const _AvatarCard({
    required this.style,
    required this.selected,
    required this.onTap,
  });

  final AvatarStyle style;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: style.label,
      excludeSemantics: true,
      child: Material(
        color: selected ? AppColors.greenTint : AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.genderCard),
          side: BorderSide(
            color: selected ? AppColors.deepGreen : AppColors.border,
            width: selected
                ? AppSizes.avatarSelectedBorder
                : AppSizes.borderWidth,
          ),
        ),
        child: InkWell(
          onTap: onTap,
          customBorder: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.genderCard),
          ),
          child: Stack(
            children: [
              Center(
                child: ChildAvatar(
                  style.key,
                  size: AppSizes.avatarPicker,
                  circle: false,
                ),
              ),
              if (selected)
                Positioned(
                  top: 8,
                  left: 8,
                  child: Container(
                    width: AppSizes.avatarCheck,
                    height: AppSizes.avatarCheck,
                    alignment: Alignment.center,
                    decoration: const BoxDecoration(
                      color: AppColors.deepGreen,
                      shape: BoxShape.circle,
                    ),
                    child: AppIcon.tick(size: 15, stroke: 3.4),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
