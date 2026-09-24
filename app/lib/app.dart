import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'core/app_scope.dart';
import 'core/mock_data.dart';
import 'features/children/data/child_profile.dart';
import 'features/children/screens/add_child_screen.dart';
import 'features/children/screens/avatar_picker_screen.dart';
import 'features/children/screens/pairing_code_screen.dart';
import 'features/children/screens/schedule_screen.dart';
import 'features/dashboard/widgets/detail_panels.dart';
import 'core/auth_gate.dart';
import 'core/debug_preview.dart';
import 'features/auth/data/auth_repository.dart';
import 'features/auth/screens/auth_screen.dart';
import 'features/auth/screens/login_screen.dart';
import 'features/auth/screens/signup_screen.dart';
import 'features/auth/data/pairing_repository.dart';
import 'features/home/screens/parent_shell.dart';
import 'features/children/data/children_repository.dart';
import 'features/subscription/data/subscription.dart';
import 'features/subscription/data/subscription_repository.dart';
import 'features/splash/screens/splash_screen.dart';
import 'theme/app_theme.dart';

class GharsahApp extends StatelessWidget {
  GharsahApp({
    super.key,
    required this.auth,
    required this.pairing,
    required this.subscriptions,
    required this.children,
  });

  final AuthRepository auth;
  final PairingRepository pairing;
  final SubscriptionRepository subscriptions;
  final ChildrenRepository children;

  final _navigatorKey = GlobalKey<NavigatorState>();

  Widget _gate() => AuthGate(
    signedIn: (_) => const ParentShell(),
    signedOut: const AuthScreen(),
  );

  void _leaveSplash() {
    _navigatorKey.currentState!.pushReplacement(
      PageRouteBuilder<void>(
        pageBuilder: (_, _, _) => _gate(),
        transitionsBuilder: (_, animation, _, child) =>
            FadeTransition(opacity: animation, child: child),
        transitionDuration: const Duration(milliseconds: 400),
      ),
    );
  }

  static const _previewDraft = ChildDraft(
    name: 'سارة',
    age: 10,
    gender: ChildGender.girl,
  );

  Widget _home() {
    switch (DebugPreview.screen) {
      case 'auth':
        return const AuthScreen();
      case 'login':
        return const LoginScreen();
      case 'login-child':
        return const LoginScreen(initialTab: 1);
      case 'signup':
        return const SignupScreen();
      case 'packages':
        return const ParentShell();
      case 'dashboard':
        return const ParentShell(
          initialTab: dashboardTab,
          initialChildId: 'mock-abdullah',
        );
      case 'addchild':
        return const AddChildScreen();
      case 'schedule':
      case 'schedule-custom':
        return ScheduleScreen(
          draft: _previewDraft,
          debugExpanded: DebugPreview.screen == 'schedule-custom',
        );
      case 'avatar':
        return AvatarPickerScreen(draft: _previewDraft);
      case 'pairing':
        return PairingCodeScreen(child: MockData.children.first);
      case 'dash-projects':
      case 'dash-surahs':
      case 'dash-hadith':
      case 'dash-ayat':
        return ParentShell(
          initialTab: dashboardTab,
          initialChildId: 'mock-abdullah',
          debugOpenCard: DashCard.values.byName(
            DebugPreview.screen!.substring('dash-'.length),
          ),
        );
      case 'playconfirm':
        return const ParentShell(debugOpenBuy: SubscriptionPlan.annual);
      case 'splash':
        return SplashScreen(
          onDone: () {},
          autoAdvance: false,
          debugAyahIndex: DebugPreview.intParam('ayah') ?? 0,
        );
      default:
        return SplashScreen(onDone: _leaveSplash);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppScope(
      auth: auth,
      pairing: pairing,
      subscriptions: subscriptions,
      children: children,
      child: MaterialApp(
        navigatorKey: _navigatorKey,
        title: 'غَرْسة',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        locale: const Locale('ar'),
        supportedLocales: const [Locale('ar')],
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        // Locale('ar') already makes the app RTL; this keeps it RTL even if a
        // future locale is added before the screens are ready for it.
        builder: (context, child) =>
            Directionality(textDirection: TextDirection.rtl, child: child!),
        home: _home(),
      ),
    );
  }
}
