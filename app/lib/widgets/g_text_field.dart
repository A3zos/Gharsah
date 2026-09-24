import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_theme.dart';

enum GFieldStatus { normal, valid, error }

/// Label + white rounded field + optional helper/error line (frames 03/04).
/// [trailing] sits at the field's visual left (end side in RTL), e.g. the
/// show/hide eye or a ✓ / ! badge; [trailingWidth] reserves that space.
class GTextField extends StatelessWidget {
  const GTextField({
    super.key,
    required this.label,
    this.labelStyle,
    this.controller,
    this.focusNode,
    this.hint,
    this.keyboardType,
    this.textInputAction,
    this.onChanged,
    this.onSubmitted,
    this.obscureText = false,
    this.ltr = false,
    this.autofillHints,
    this.inputFormatters,
    this.height = AppSizes.fieldHeight,
    this.radius = AppRadii.input,
    this.labelGap = 8,
    this.status = GFieldStatus.normal,
    this.message,
    this.trailing,
    this.trailingWidth = 0,
    this.enabled = true,
    this.below,
  });

  final String label;
  final TextStyle? labelStyle;
  final TextEditingController? controller;
  final FocusNode? focusNode;
  final String? hint;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final bool obscureText;
  final bool ltr;
  final Iterable<String>? autofillHints;
  final List<TextInputFormatter>? inputFormatters;
  final double height;
  final double radius;
  final double labelGap;
  final GFieldStatus status;
  final String? message;
  final Widget? trailing;
  final double trailingWidth;
  final bool enabled;

  /// Extra row under the field (e.g. the password strength bar), before [message].
  final Widget? below;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final borderColor = switch (status) {
      GFieldStatus.valid => AppColors.primary,
      GFieldStatus.error => AppColors.berry,
      GFieldStatus.normal => AppColors.inputBorder,
    };
    final focusColor = status == GFieldStatus.error
        ? AppColors.berry
        : AppColors.primary;
    OutlineInputBorder outline(Color c) => OutlineInputBorder(
      borderRadius: BorderRadius.circular(radius),
      borderSide: BorderSide(color: c, width: AppSizes.borderWidth),
    );
    final messageColor = switch (status) {
      GFieldStatus.valid => AppColors.deepGreen,
      GFieldStatus.error => AppColors.errorText,
      GFieldStatus.normal => AppColors.textMuted,
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label, style: labelStyle ?? t.labelLarge),
        SizedBox(height: labelGap),
        TextField(
          controller: controller,
          focusNode: focusNode,
          enabled: enabled,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          onChanged: onChanged,
          onSubmitted: onSubmitted,
          obscureText: obscureText,
          autocorrect: !obscureText && !ltr,
          enableSuggestions: !obscureText && !ltr,
          autofillHints: autofillHints,
          inputFormatters: inputFormatters,
          textDirection: ltr ? TextDirection.ltr : null,
          textAlign: ltr ? TextAlign.left : TextAlign.start,
          textAlignVertical: TextAlignVertical.center,
          style: AppTextStyles.input,
          cursorColor: AppColors.deepGreen,
          decoration: InputDecoration(
            hintText: hint,
            hintTextDirection: ltr ? TextDirection.ltr : null,
            constraints: BoxConstraints.tightFor(height: height),
            // Vertical padding makes the field exactly [height] tall with or
            // without a trailing widget (16px text × Cairo's normal line height).
            contentPadding: EdgeInsetsDirectional.only(
              start: AppSizes.fieldPaddingH,
              end: trailing == null ? AppSizes.fieldPaddingH : 0,
              top: (height - 16 * AppFonts.cairoNormal) / 2,
              bottom: (height - 16 * AppFonts.cairoNormal) / 2,
            ),
            suffixIcon: trailing == null
                ? null
                : SizedBox(width: trailingWidth, child: trailing),
            // Width only: the padding above already sets the field height.
            suffixIconConstraints: BoxConstraints.tightFor(
              width: trailingWidth,
            ),
            enabledBorder: outline(borderColor),
            disabledBorder: outline(borderColor),
            focusedBorder: outline(
              status == GFieldStatus.normal ? focusColor : borderColor,
            ),
          ),
        ),
        if (below != null) ...[SizedBox(height: labelGap), below!],
        if (message != null) ...[
          SizedBox(height: labelGap),
          Text(
            message!,
            style: AppTextStyles.helper.copyWith(color: messageColor),
          ),
        ],
      ],
    );
  }
}

/// Round 24px status badge used inside signup fields (✓ valid / ! error).
class GFieldBadge extends StatelessWidget {
  const GFieldBadge({super.key, required this.valid, required this.child});

  final bool valid;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: AlignmentDirectional.centerEnd,
      child: Padding(
        padding: const EdgeInsetsDirectional.only(end: 16),
        child: Container(
          width: 24,
          height: 24,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: valid ? AppColors.primary : AppColors.berryTint,
            shape: BoxShape.circle,
          ),
          child: child,
        ),
      ),
    );
  }
}

/// Show/hide password toggle placed at the field's end (visual left in RTL).
class GEyeButton extends StatelessWidget {
  const GEyeButton({
    super.key,
    required this.visible,
    required this.onPressed,
    required this.icon,
  });

  final bool visible;
  final VoidCallback onPressed;
  final Widget icon;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: AlignmentDirectional.centerEnd,
      child: Padding(
        // Design: 44px button 8px from the edge; a 48px target keeps the same centre.
        padding: const EdgeInsetsDirectional.only(end: 6),
        child: IconButton(
          onPressed: onPressed,
          tooltip: visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور',
          icon: icon,
          style: IconButton.styleFrom(
            minimumSize: const Size.square(AppSizes.minTouch),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadii.eyeButton),
            ),
          ),
        ),
      ),
    );
  }
}
