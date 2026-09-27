import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/arabic_digits.dart';
import '../theme/app_theme.dart';

/// Six boxes for the child's pairing code (frame 03, child tab).
///
/// One hidden text field holds the whole code, so typing auto-advances,
/// backspace moves back to the previous box, and paste works on every
/// platform. Latin / Persian digits are converted to Arabic-Indic as typed;
/// anything else is ignored.
class CodeInput extends StatefulWidget {
  const CodeInput({
    super.key,
    required this.controller,
    this.focusNode,
    this.length = 6,
    this.error = false,
    this.enabled = true,
    this.onChanged,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final FocusNode? focusNode;
  final int length;
  final bool error;
  final bool enabled;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onSubmitted;

  @override
  State<CodeInput> createState() => _CodeInputState();
}

class _CodeInputState extends State<CodeInput> {
  late final FocusNode _focus = widget.focusNode ?? FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(_rebuild);
    widget.controller.addListener(_rebuild);
  }

  void _rebuild() => setState(() {});

  @override
  void dispose() {
    _focus.removeListener(_rebuild);
    widget.controller.removeListener(_rebuild);
    if (widget.focusNode == null) _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final text = widget.controller.text;
    final active = _focus.hasFocus
        ? text.length.clamp(0, widget.length - 1)
        : -1;

    final boxes = Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (var i = 0; i < widget.length; i++) ...[
          if (i > 0) const SizedBox(width: 8),
          _Cell(
            digit: i < text.length ? text[i] : '',
            error: widget.error,
            active: i == active && !widget.error,
          ),
        ],
      ],
    );

    return Semantics(
      label: 'رمز الربط، ${widget.length.arabicDigits} أرقام',
      value: text,
      textField: true,
      child: Directionality(
        // Codes read left-to-right, as in the design (`direction: ltr`).
        textDirection: TextDirection.ltr,
        child: Stack(
          alignment: Alignment.center,
          children: [
            boxes,
            Positioned.fill(
              child: ExcludeSemantics(
                child: TextField(
                  controller: widget.controller,
                  focusNode: _focus,
                  enabled: widget.enabled,
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.done,
                  autocorrect: false,
                  enableSuggestions: false,
                  enableInteractiveSelection: false,
                  showCursor: false,
                  inputFormatters: [_ArabicDigitsFormatter(widget.length)],
                  onChanged: widget.onChanged,
                  onSubmitted: (_) => widget.onSubmitted?.call(),
                  style: const TextStyle(
                    color: Colors.transparent,
                    fontSize: 1,
                  ),
                  decoration: const InputDecoration(
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    disabledBorder: InputBorder.none,
                    filled: false,
                    counterText: '',
                    contentPadding: EdgeInsets.zero,
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

class _Cell extends StatelessWidget {
  const _Cell({required this.digit, required this.error, required this.active});

  final String digit;
  final bool error;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final border = error
        ? AppColors.berry
        : active
        ? AppColors.primary
        : AppColors.inputBorder;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      width: AppSizes.codeCellWidth,
      height: AppSizes.codeCellHeight,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.codeCell),
        border: Border.all(color: border, width: AppSizes.borderWidth),
      ),
      child: Text(digit, style: AppTextStyles.codeDigit),
    );
  }
}

/// Keeps only digits (any script), converts them to Arabic-Indic, caps the length.
class _ArabicDigitsFormatter extends TextInputFormatter {
  _ArabicDigitsFormatter(this.max);

  final int max;

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final out = StringBuffer();
    for (final ch in newValue.text.split('')) {
      final d = ArabicDigits.normalizeDigit(ch);
      if (d != null && out.length < max) out.write(d);
    }
    final text = out.toString();
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}
