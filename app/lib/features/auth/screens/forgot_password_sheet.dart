import 'package:flutter/material.dart';

import '../../../core/app_scope.dart';
import '../../../core/validators.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/g_text_field.dart';
import '../../../widgets/loading_label.dart';
import '../data/auth_failure.dart';

/// «نسيت كلمة المرور؟» — asks for the email and sends a reset link.
Future<void> showForgotPasswordSheet(
  BuildContext context, {
  String initialEmail = '',
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => _ForgotPasswordSheet(initialEmail: initialEmail),
  );
}

class _ForgotPasswordSheet extends StatefulWidget {
  const _ForgotPasswordSheet({required this.initialEmail});

  final String initialEmail;

  @override
  State<_ForgotPasswordSheet> createState() => _ForgotPasswordSheetState();
}

class _ForgotPasswordSheetState extends State<_ForgotPasswordSheet> {
  late final _email = TextEditingController(text: widget.initialEmail);
  bool _busy = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (!Validators.isEmail(_email.text)) {
      setState(() => _error = 'اكتب بريدًا إلكترونيًا صحيحًا.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AppScope.of(context).auth.sendPasswordReset(_email.text);
      if (mounted) setState(() => _sent = true);
    } on AuthFailure catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSizes.screenPaddingH,
        0,
        AppSizes.screenPaddingH,
        24 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('استعادة كلمة المرور', style: t.headlineSmall),
            const SizedBox(height: 6),
            Text(
              _sent
                  ? 'إن كان هذا البريد مسجّلًا لدينا فستصلك رسالة خلال دقائق. تحقّق من صندوق الوارد والرسائل غير المرغوب فيها.'
                  : 'أدخل بريدك الإلكتروني وسنرسل إليك رابطًا لتعيين كلمة مرور جديدة.',
              style: t.bodyMedium,
            ),
            const SizedBox(height: 18),
            if (!_sent)
              GTextField(
                label: 'البريد الإلكتروني',
                controller: _email,
                hint: 'name@example.com',
                ltr: true,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.send,
                autofillHints: const [AutofillHints.email],
                onSubmitted: (_) => _send(),
                onChanged: (_) {
                  if (_error != null) setState(() => _error = null);
                },
                status: _error == null
                    ? GFieldStatus.normal
                    : GFieldStatus.error,
                message: _error,
              ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: _busy
                  ? null
                  : (_sent ? () => Navigator.of(context).pop() : _send),
              child: LoadingLabel(
                loading: _busy,
                label: _sent ? 'حسنًا' : 'إرسال الرابط',
              ),
            ),
          ],
        ),
      ),
    );
  }
}
