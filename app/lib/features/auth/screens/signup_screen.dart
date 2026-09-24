import 'package:flutter/material.dart';

import '../../../core/app_scope.dart';
import '../../../core/validators.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/app_icons.dart';
import '../../../widgets/decor_blob.dart';
import '../../../widgets/footer_link.dart';
import '../../../widgets/g_back_button.dart';
import '../../../widgets/g_text_field.dart';
import '../../../widgets/loading_label.dart';
import '../../../widgets/screen_frame.dart';
import '../data/auth_failure.dart';
import '../data/auth_repository.dart';
import 'login_screen.dart';

/// Frame 04 — parent signup: name, email, password (+ strength), confirm.
class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  final _emailFocus = FocusNode();
  final _passwordFocus = FocusNode();
  final _confirmFocus = FocusNode();

  bool _showPassword = false;
  bool _busy = false;
  bool _submitted = false;
  bool _emailTouched = false;
  String? _serverEmailError;
  String? _serverPasswordError;
  String? _generalError;

  @override
  void initState() {
    super.initState();
    for (final c in [_name, _email, _password, _confirm]) {
      c.addListener(_onEdit);
    }
    _emailFocus.addListener(() {
      if (!_emailFocus.hasFocus && _email.text.isNotEmpty) {
        setState(() => _emailTouched = true);
      }
    });
  }

  void _onEdit() => setState(() {
    _serverEmailError = _serverPasswordError = _generalError = null;
  });

  @override
  void dispose() {
    for (final c in [_name, _email, _password, _confirm]) {
      c.dispose();
    }
    _emailFocus.dispose();
    _passwordFocus.dispose();
    _confirmFocus.dispose();
    super.dispose();
  }

  // ── Live validation (as in the design: ✓ valid email, mismatch error) ──

  bool get _emailValid => Validators.isEmail(_email.text);

  String? get _nameError =>
      _submitted && _name.text.trim().isEmpty ? 'اكتب اسمك.' : null;

  String? get _emailError {
    if (_serverEmailError != null) return _serverEmailError;
    final show = _submitted || _emailTouched;
    return show && !_emailValid ? 'اكتب بريدًا إلكترونيًا صحيحًا.' : null;
  }

  String? get _passwordError {
    if (_serverPasswordError != null) return _serverPasswordError;
    return _submitted &&
            _password.text.length < AuthRepository.minPasswordLength
        ? 'كلمة المرور ٨ أحرف على الأقل.'
        : null;
  }

  String? get _confirmError {
    if (_confirm.text.isEmpty) {
      return _submitted ? 'أعد كتابة كلمة المرور.' : null;
    }
    return _confirm.text != _password.text
        ? 'لا تطابق كلمة المرور — تحقّق مرة أخرى.'
        : null;
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    setState(() => _submitted = true);
    if (_nameError != null ||
        _emailError != null ||
        _passwordError != null ||
        _confirmError != null) {
      return;
    }
    setState(() => _busy = true);
    final nav = Navigator.of(context);
    try {
      await AppScope.of(context).auth.signUp(
        name: _name.text,
        email: _email.text,
        password: _password.text,
      );
      // AuthGate underneath now shows the parent home (Packages).
      nav.popUntil((r) => r.isFirst);
    } on AuthFailure catch (e) {
      if (!mounted) return;
      setState(() {
        switch (e.field) {
          case AuthField.email:
            _serverEmailError = e.message;
          case AuthField.password:
            _serverPasswordError = e.message;
          case AuthField.general:
            _generalError = e.message;
        }
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final emailStatus = _emailError != null
        ? GFieldStatus.error
        : _emailValid
        ? GFieldStatus.valid
        : GFieldStatus.normal;
    final confirmError = _confirmError;

    return ScreenFrame(
      padding: const EdgeInsets.fromLTRB(
        AppSizes.screenPaddingH,
        30,
        AppSizes.screenPaddingH,
        30 - FooterLink.targetExtra,
      ),
      blobs: [
        DecorBlob(
          top: -160,
          left: -140,
          size: 350,
          color: AppColors.blobGoldStrong,
        ),
      ],
      child: AutofillGroup(
        child: TopBottom(
          minGap: 18,
          top: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const GBackButton(),
              const SizedBox(height: 18),
              Text('إنشاء حساب وليّ الأمر', style: t.headlineMedium),
              const SizedBox(height: 5),
              Text('دقيقة واحدة، ثم نضيف أبناءك.', style: t.bodyMedium),
              const SizedBox(height: 18),
              _field(
                label: 'الاسم',
                controller: _name,
                hint: 'الاسم الكامل',
                keyboardType: TextInputType.name,
                autofill: AutofillHints.name,
                next: _emailFocus,
                status: _nameError == null
                    ? GFieldStatus.normal
                    : GFieldStatus.error,
                message: _nameError,
              ),
              const SizedBox(height: 14),
              _field(
                label: 'البريد الإلكتروني',
                controller: _email,
                focusNode: _emailFocus,
                hint: 'name@example.com',
                ltr: true,
                keyboardType: TextInputType.emailAddress,
                autofill: AutofillHints.email,
                next: _passwordFocus,
                status: emailStatus,
                message:
                    _emailError ??
                    (_emailValid ? 'بريد صالح — سنرسل إليه تأكيدًا.' : null),
                trailingWidth: emailStatus == GFieldStatus.normal ? 0 : 52,
                trailing: _badge(emailStatus),
              ),
              const SizedBox(height: 14),
              _field(
                label: 'كلمة المرور',
                controller: _password,
                focusNode: _passwordFocus,
                hint: '٨ أحرف على الأقل',
                obscure: !_showPassword,
                autofill: AutofillHints.newPassword,
                next: _confirmFocus,
                status: _passwordError == null
                    ? GFieldStatus.normal
                    : GFieldStatus.error,
                message: _passwordError,
                trailingWidth: 58,
                trailing: GEyeButton(
                  visible: _showPassword,
                  onPressed: () =>
                      setState(() => _showPassword = !_showPassword),
                  icon: AppIcon.eye(slashed: _showPassword),
                ),
                below: _StrengthBar(password: _password.text),
              ),
              const SizedBox(height: 14),
              _field(
                label: 'تأكيد كلمة المرور',
                controller: _confirm,
                focusNode: _confirmFocus,
                hint: 'أعد كتابتها',
                obscure: !_showPassword,
                autofill: AutofillHints.newPassword,
                onSubmitted: _submit,
                status: confirmError == null
                    ? GFieldStatus.normal
                    : GFieldStatus.error,
                message: confirmError,
                trailingWidth: confirmError == null ? 0 : 52,
                trailing: confirmError == null
                    ? null
                    : _badge(GFieldStatus.error),
              ),
            ],
          ),
          bottom: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_generalError != null) ...[
                Text(
                  _generalError!,
                  style: AppTextStyles.helper.copyWith(
                    color: AppColors.errorText,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 10),
              ],
              FilledButton(
                onPressed: _busy ? null : _submit,
                child: LoadingLabel(loading: _busy, label: 'إنشاء الحساب'),
              ),
              const SizedBox(height: 12 - FooterLink.targetExtra),
              FooterLink(
                prompt: 'لديك حساب؟',
                action: 'تسجيل دخول',
                onTap: () => Navigator.of(context).pushReplacement(
                  MaterialPageRoute<void>(builder: (_) => const LoginScreen()),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget? _badge(GFieldStatus status) => switch (status) {
    GFieldStatus.valid => GFieldBadge(valid: true, child: AppIcon.check()),
    GFieldStatus.error => GFieldBadge(valid: false, child: AppIcon.exclaim()),
    GFieldStatus.normal => null,
  };

  Widget _field({
    required String label,
    required TextEditingController controller,
    FocusNode? focusNode,
    required String hint,
    TextInputType? keyboardType,
    bool ltr = false,
    bool obscure = false,
    required String autofill,
    FocusNode? next,
    VoidCallback? onSubmitted,
    required GFieldStatus status,
    String? message,
    Widget? trailing,
    double trailingWidth = 0,
    Widget? below,
  }) {
    return GTextField(
      label: label,
      labelStyle: AppTextStyles.labelCompact,
      labelGap: 7,
      height: AppSizes.fieldHeightCompact,
      radius: AppRadii.inputCompact,
      controller: controller,
      focusNode: focusNode,
      hint: hint,
      ltr: ltr,
      keyboardType: keyboardType,
      obscureText: obscure,
      autofillHints: [autofill],
      textInputAction: next != null
          ? TextInputAction.next
          : TextInputAction.done,
      onSubmitted: (_) =>
          next != null ? next.requestFocus() : onSubmitted?.call(),
      enabled: !_busy,
      status: status,
      message: message,
      trailing: trailing,
      trailingWidth: trailingWidth,
      below: below,
    );
  }
}

/// Three-segment strength bar + label (design shows «جيدة» with two segments).
class _StrengthBar extends StatelessWidget {
  const _StrengthBar({required this.password});

  final String password;

  static int score(String p) {
    if (p.isEmpty) return 0;
    if (p.length < AuthRepository.minPasswordLength) return 1;
    final letters = RegExp(r'[A-Za-z؀-ۿ]').hasMatch(p);
    final digits = RegExp(r'[0-9٠-٩]').hasMatch(p);
    final symbols = RegExp(r'[^A-Za-z0-9؀-ۿ٠-٩]').hasMatch(p);
    final variety = [letters, digits, symbols].where((b) => b).length;
    return (variety >= 3 || (variety == 2 && p.length >= 12)) ? 3 : 2;
  }

  @override
  Widget build(BuildContext context) {
    final s = score(password);
    const labels = ['', 'ضعيفة', 'جيدة', 'قوية'];
    return Semantics(
      label: s == 0 ? null : 'قوة كلمة المرور: ${labels[s]}',
      child: Row(
        children: [
          Expanded(
            child: Row(
              children: [
                for (var i = 0; i < 3; i++) ...[
                  if (i > 0) const SizedBox(width: 5),
                  Expanded(
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      height: AppSizes.strengthBarHeight,
                      decoration: BoxDecoration(
                        color: i < s ? AppColors.primary : AppColors.border,
                        borderRadius: BorderRadius.circular(
                          AppSizes.strengthBarHeight / 2,
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(labels[s], style: AppTextStyles.helper),
        ],
      ),
    );
  }
}
