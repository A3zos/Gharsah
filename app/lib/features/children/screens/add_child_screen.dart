import 'package:flutter/material.dart';

import '../../../core/arabic_digits.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/app_icons.dart';
import '../../../widgets/g_back_button.dart';
import '../../../widgets/g_text_field.dart';
import '../../../widgets/info_note.dart';
import '../../../widgets/screen_frame.dart';
import '../data/child_profile.dart';
import '../widgets/add_child_stepper.dart';
import 'schedule_screen.dart';

/// Frame 07 — «إضافة ابن», step 1 «البيانات»: name, age ٨–١٣, girl/boy.
///
/// Flow: AddChild → Schedule (08/09) → AvatarPicker (10, saves the child)
/// → PairingCode (11).
/// TODO(phase-c): require a verified email before a child can be added.
class AddChildScreen extends StatefulWidget {
  const AddChildScreen({super.key});

  @override
  State<AddChildScreen> createState() => _AddChildScreenState();
}

class _AddChildScreenState extends State<AddChildScreen> {
  static const _ages = [8, 9, 10, 11, 12, 13];

  final _name = TextEditingController();
  int _age = 10; // design default
  ChildGender _gender = ChildGender.girl; // design default
  bool _submitted = false;

  @override
  void initState() {
    super.initState();
    _name.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  String? get _nameError =>
      _submitted && _name.text.trim().isEmpty ? 'اكتب اسم الابن.' : null;

  void _next() {
    FocusScope.of(context).unfocus();
    setState(() => _submitted = true);
    if (_nameError != null) return;
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ScheduleScreen(
          draft: ChildDraft(
            name: _name.text.trim(),
            age: _age,
            gender: _gender,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return ScreenFrame(
      padding: const EdgeInsets.fromLTRB(
        AppSizes.pagePaddingH,
        30,
        AppSizes.pagePaddingH,
        30,
      ),
      child: TopBottom(
        minGap: 20,
        top: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const GBackButton(),
                const SizedBox(width: 12),
                Text('إضافة ابن', style: AppTextStyles.pageTitleSmall),
              ],
            ),
            const SizedBox(height: 20),
            const AddChildStepper(current: 0),
            const SizedBox(height: 20),
            GTextField(
              label: 'اسم الابن',
              controller: _name,
              hint: 'الاسم كما يحبّ أن يُنادى',
              keyboardType: TextInputType.name,
              textInputAction: TextInputAction.done,
              status: _nameError == null
                  ? GFieldStatus.normal
                  : GFieldStatus.error,
              message: _nameError,
            ),
            const SizedBox(height: 20),
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('العمر', style: t.labelLarge),
                Text('من ٨ إلى ١٣ سنة', style: AppTextStyles.caption),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                for (final age in _ages) ...[
                  if (age != _ages.first) const SizedBox(width: 8),
                  Expanded(
                    child: _AgeChip(
                      age: age,
                      selected: age == _age,
                      onTap: () => setState(() => _age = age),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 20),
            Text('الجنس', style: t.labelLarge),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _GenderCard(
                    label: 'بنت',
                    avatar: AppIcon.childAvatar(
                      'g1',
                      size: AppSizes.genderAvatar,
                    ),
                    selected: _gender == ChildGender.girl,
                    onTap: () => setState(() => _gender = ChildGender.girl),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _GenderCard(
                    label: 'ولد',
                    avatar: AppIcon.childAvatar(
                      'b1',
                      size: AppSizes.genderAvatar,
                    ),
                    selected: _gender == ChildGender.boy,
                    onTap: () => setState(() => _gender = ChildGender.boy),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            const InfoNote(
              tone: InfoNoteTone.greenInfo,
              lineHeight: 1.8,
              text: 'العمر يحدّد مستوى الحفظ والتمارين المقترحة، ويمكنك تعديله لاحقًا من لوحة التحكم.',
            ),
          ],
        ),
        bottom: FilledButton(
          onPressed: _next,
          child: const Text('التالي — جدول التعلّم'),
        ),
      ),
    );
  }
}

class _AgeChip extends StatelessWidget {
  const _AgeChip({
    required this.age,
    required this.selected,
    required this.onTap,
  });

  final int age;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: '${age.arabicDigits} ${age <= 10 ? 'سنوات' : 'سنة'}',
      excludeSemantics: true,
      child: Material(
        color: selected ? AppColors.greenTint : AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.ageChip),
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
            borderRadius: BorderRadius.circular(AppRadii.ageChip),
          ),
          child: SizedBox(
            height: AppSizes.ageChipHeight,
            child: Center(
              child: Text(
                age.arabicDigits,
                style: AppTextStyles.ageDigit.copyWith(
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

class _GenderCard extends StatelessWidget {
  const _GenderCard({
    required this.label,
    required this.avatar,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final Widget avatar;
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
          borderRadius: BorderRadius.circular(AppRadii.genderCard),
          side: BorderSide(
            color: selected ? AppColors.deepGreen : AppColors.border,
            width: selected
                ? AppSizes.selectedBorderWidth
                : AppSizes.borderWidth,
          ),
        ),
        child: InkWell(
          onTap: onTap,
          customBorder: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.genderCard),
          ),
          child: SizedBox(
            height: AppSizes.genderCardHeight,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                avatar,
                const SizedBox(height: 8),
                Text(label, style: AppTextStyles.optionLabel),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
