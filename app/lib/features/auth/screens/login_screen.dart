import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../../core/app_scope.dart';
import '../../../core/arabic_digits.dart';
import '../../../core/validators.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/app_icons.dart';
import '../../../widgets/code_input.dart';
import '../../../widgets/decor_blob.dart';
import '../../../widgets/footer_link.dart';
import '../../../widgets/g_back_button.dart';
import '../../../widgets/g_segmented_tabs.dart';
import '../../../widgets/g_text_field.dart';
import '../../../widgets/info_note.dart';
import '../../../widgets/loading_label.dart';
import '../../../widgets/screen_frame.dart';
import '../../student/data/child_session.dart';
import '../data/auth_failure.dart';
import 'forgot_password_sheet.dart';
import 'signup_screen.dart';

// A footer / link row is padded to a 48px tap target; these take the extra
// height back out of the surrounding gaps so the visible layout matches the design.
const double _forgotTargetExtra =
    (AppSizes.minTouch - 37.3) / 2; // 13.5 line + 6/6 padding

// Tab content is at least this tall, as in the design (`min-height: 540px`),
// so the button + footer sit at the bottom of the frame.
const double _tabMinHeight = 540;

/// Frame 03 — login with two tabs: «ولي الأمر» (email) and «الطفل» (pairing code).
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, this.initialTab = 0});

  final int initialTab;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  late int _tab = widget.initialTab;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final isParent = _tab == 0;
    return ScreenFrame(
      padding: const EdgeInsets.fromLTRB(
        AppSizes.screenPaddingH,
        30,
        AppSizes.screenPaddingH,
        36 -
            FooterLink
                .targetExtra, // the parent footer's tap target fills the rest
      ),
      blobs: [
        DecorBlob(
          top: -150,
          left: -130,
          size: 340,
          color: AppColors.blobGreenStrong,
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const GBackButton(),
          const SizedBox(height: 20),
          Text('أهلًا بعودتك', style: t.headlineLarge),
          const SizedBox(height: 6),
          Text(
            isParent
                ? 'سجّل دخولك لمتابعة تقدّم أبنائك.'
                : 'ادخل برمز الدعوة الذي أعطاك إياه والدك.',
            style: AppTextStyles.subtitle,
          ),
          const SizedBox(height: 20),
          GSegmentedTabs(
            selected: _tab,
            onChanged: (i) => setState(() => _tab = i),
            segments: [
              GSegment(
                label: 'ولي الأمر',
                icon: (c) => AppIcon.person(color: c),
              ),
              GSegment(
                label: 'الطفل',
                icon: (c) => AppIcon.sproutMono(color: c),
              ),
            ],
          ),
          const SizedBox(height: 20),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 280),
            transitionBuilder: (child, a) => FadeTransition(
              opacity: a,
              child: SlideTransition(
                position: Tween(
                  begin: const Offset(0, 0.015),
                  end: Offset.zero,
                ).animate(a),
                child: child,
              ),
            ),
            layoutBuilder: (current, previous) =>
                Stack(children: [...previous, ?current]),
            child: isParent
                ? const _ParentForm(key: ValueKey('parent'))
                : const _ChildForm(key: ValueKey('child')),
          ),
        ],
      ),
    );
  }
}

// ───────────────────────────── Parent tab ─────────────────────────────

class _ParentForm extends StatefulWidget {
  const _ParentForm({super.key});

  @override
  State<_ParentForm> createState() => _ParentFormState();
}

class _ParentFormState extends State<_ParentForm> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _passwordFocus = FocusNode();
  bool _showPassword = false;
  bool _busy = false;
  String? _emailError;
  String? _passwordError;
  String? _generalError;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  void _clearErrors() {
    if (_emailError == null &&
        _passwordError == null &&
        _generalError == null) {
      return;
    }
    setState(() => _emailError = _passwordError = _generalError = null);
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    final emailOk = Validators.isEmail(_email.text);
    final passOk = _password.text.isNotEmpty;
    setState(() {
      _emailError = emailOk ? null : 'اكتب بريدًا إلكترونيًا صحيحًا.';
      _passwordError = passOk ? null : 'اكتب كلمة المرور.';
      _generalError = null;
    });
    if (!emailOk || !passOk) return;

    setState(() => _busy = true);
    final nav = Navigator.of(context);
    try {
      await AppScope.of(context).auth
          .signIn(email: _email.text, password: _password.text);
      // The AuthGate underneath now shows the parent home.
      nav.popUntil((r) => r.isFirst);
    } on AuthFailure catch (e) {
      if (!mounted) return;
      setState(() {
        switch (e.field) {
          case AuthField.email:
            _emailError = e.message;
          case AuthField.password:
            _passwordError = e.message;
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
    return AutofillGroup(
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: _tabMinHeight),
        child: TopBottom(
          minGap: 18,
          top: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              GTextField(
                label: 'البريد الإلكتروني',
                controller: _email,
                hint: 'name@example.com',
                ltr: true,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autofillHints: const [
                  AutofillHints.email,
                  AutofillHints.username,
                ],
                onSubmitted: (_) => _passwordFocus.requestFocus(),
                onChanged: (_) => _clearErrors(),
                enabled: !_busy,
                status: _emailError == null
                    ? GFieldStatus.normal
                    : GFieldStatus.error,
                message: _emailError,
              ),
              const SizedBox(height: 18),
              GTextField(
                label: 'كلمة المرور',
                controller: _password,
                focusNode: _passwordFocus,
                hint: '••••••••',
                obscureText: !_showPassword,
                textInputAction: TextInputAction.done,
                autofillHints: const [AutofillHints.password],
                onSubmitted: (_) => _submit(),
                onChanged: (_) => _clearErrors(),
                enabled: !_busy,
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
              ),
              const SizedBox(height: 18 - _forgotTargetExtra),
              // Design box is 37.3px (13.5px text + 6/6 padding); a 48px row keeps
              // the text at the same place and gives a full-size tap target.
              SizedBox(
                height: AppSizes.minTouch,
                child: Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: InkWell(
                    onTap: _busy
                        ? null
                        : () => showForgotPasswordSheet(
                            context,
                            initialEmail: _email.text.trim(),
                          ),
                    borderRadius: BorderRadius.circular(AppRadii.chip),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 2),
                      child: Text(
                        'نسيت كلمة المرور؟',
                        style: AppTextStyles.linkSmall,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 18 - _forgotTargetExtra),
              const InfoNote(
                text: 'حساب وليّ الأمر فقط. لا ينشئ الطفل حسابًا — يدخل برمز الربط.',
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
                child: LoadingLabel(loading: _busy, label: 'تسجيل الدخول'),
              ),
              const SizedBox(height: 14 - FooterLink.targetExtra),
              FooterLink(
                prompt: 'ليس لديك حساب؟',
                action: 'إنشاء حساب',
                onTap: () => Navigator.of(context).pushReplacement(
                  MaterialPageRoute<void>(builder: (_) => const SignupScreen()),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ───────────────────────────── Child tab ─────────────────────────────

enum _CodeStatus { none, incomplete, wrong, verified, tooMany, offline, failed }

class _ChildForm extends StatefulWidget {
  const _ChildForm({super.key});

  @override
  State<_ChildForm> createState() => _ChildFormState();
}

class _ChildFormState extends State<_ChildForm> {
  /// DEBUG builds only: prefilled with the demo code ٤٧٢٩١٨.
  final _code = TextEditingController(
    text: kDebugMode ? _debugDemoCode.arabicDigits : '',
  );

  static const _debugDemoCode = '472918';
  _CodeStatus _status = _CodeStatus.none;
  bool _busy = false;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_code.text.length < 6) {
      setState(() => _status = _CodeStatus.incomplete);
      return;
    }
    setState(() => _busy = true);
    final nav = Navigator.of(context);
    final repo = AppScope.of(context).childSession;
    _CodeStatus status;
    // DEBUG builds only: the demo code enters as the in-memory mock child
    // «عبدالله» without touching the server. Compiled out of release builds.
    if (kDebugMode && _code.text.latinDigits == _debugDemoCode) {
      setState(() {
        _busy = false;
        _status = _CodeStatus.verified;
      });
      await Future<void>.delayed(const Duration(milliseconds: 600));
      repo.debugUseMockChild();
      nav.popUntil((r) => r.isFirst);
      return;
    }
    try {
      // Anonymous sign-in + claimPairingCode on the server; only the verified
      // session is cached on this device.
      await repo.claim(_code.text.latinDigits);
      status = _CodeStatus.verified;
    } on ClaimFailure catch (e) {
      status = switch (e.error) {
        ClaimError.wrong => _CodeStatus.wrong,
        ClaimError.tooManyAttempts => _CodeStatus.tooMany,
        ClaimError.offline => _CodeStatus.offline,
        ClaimError.unknown => _CodeStatus.failed,
      };
    }
    if (!mounted) return;
    setState(() {
      _busy = false;
      _status = status;
    });
    if (status == _CodeStatus.verified) {
      // Let «تم التحقق» show, then the gate below opens the child app.
      await Future<void>.delayed(const Duration(milliseconds: 900));
      nav.popUntil((r) => r.isFirst);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: _tabMinHeight),
      child: TopBottom(
        minGap: 18,
        top: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 6),
            Center(child: AppIcon.logoChild(size: AppSizes.logoChild)),
            const SizedBox(height: 12),
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 260),
                child: Text(
                  'أدخل الرمز الذي أعطاك إياه والدك.',
                  style: AppTextStyles.childPrompt,
                  textAlign: TextAlign.center,
                ),
              ),
            ),
            const SizedBox(height: 18),
            Text(
              'رمز الدعوة',
              style: t.labelLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 10),
            CodeInput(
              controller: _code,
              error:
                  _status == _CodeStatus.wrong ||
                  _status == _CodeStatus.tooMany,
              enabled: !_busy && _status != _CodeStatus.verified,
              onChanged: (_) {
                if (_status != _CodeStatus.none) {
                  setState(() => _status = _CodeStatus.none);
                }
              },
              onSubmitted: _submit,
            ),
            const SizedBox(height: 10),
            ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 26),
              child: Center(child: _statusLine()),
            ),
            const SizedBox(height: 18),
            const InfoNote(
              tone: InfoNoteTone.gold,
              text: 'لا تحتاج بريدًا ولا كلمة مرور — الرمز وحده يكفي.',
            ),
          ],
        ),
        bottom: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            FilledButton(
              onPressed: _busy || _status == _CodeStatus.verified
                  ? null
                  : _submit,
              child: LoadingLabel(loading: _busy, label: 'دخول'),
            ),
            const SizedBox(height: FooterLink.targetExtra),
          ],
        ),
      ),
    );
  }

  Widget _statusLine() {
    final base = Theme.of(context).textTheme.labelMedium!;
    Widget row(Widget? icon, String text, Color color) => Semantics(
      liveRegion: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[icon, const SizedBox(width: 7)],
          Text(text, style: base.copyWith(color: color)),
        ],
      ),
    );
    return switch (_status) {
      _CodeStatus.none => const SizedBox.shrink(),
      _CodeStatus.incomplete => row(
        null,
        'أكمل الخانات الستّ.',
        AppColors.warningText,
      ),
      _CodeStatus.wrong => row(
        AppIcon.alertCircle(),
        'الرمز غير صحيح',
        AppColors.errorText,
      ),
      // TODO(design): the three states below have no designed copy yet;
      // they reuse frame 03's error line style.
      _CodeStatus.tooMany => row(
        AppIcon.alertCircle(),
        'محاولات كثيرة — انتظر قليلًا ثم جرّب',
        AppColors.errorText,
      ),
      _CodeStatus.offline => row(
        AppIcon.alertCircle(),
        'لا يوجد اتصال — تحقّق من الإنترنت',
        AppColors.errorText,
      ),
      _CodeStatus.failed => row(
        AppIcon.alertCircle(),
        'حدث خطأ — حاول مرة أخرى',
        AppColors.errorText,
      ),
      _CodeStatus.verified => row(
        AppIcon.checkCircle(),
        'تم التحقق — جارٍ فتح تطبيق الطفل',
        AppColors.deepGreen,
      ),
    };
  }
}
