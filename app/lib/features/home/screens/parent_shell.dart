import 'package:flutter/material.dart';

import '../../../core/app_scope.dart';
import '../../../widgets/app_icons.dart';
import '../../../widgets/g_bottom_nav.dart';
import '../../children/data/child_profile.dart';
import '../../children/screens/add_child_screen.dart';
import '../../dashboard/screens/dashboard_screen.dart';
import '../../dashboard/widgets/detail_panels.dart';
import '../../packages/screens/packages_screen.dart';
import '../../subscription/data/subscription.dart';
import '../../subscription/screens/play_confirm_screen.dart';

/// Signed-in parent: «لوحة التحكم» / «الباقات» tabs (05-Packages bottom nav).
/// Android back on the dashboard tab returns to «الباقات» instead of exiting.
class ParentShell extends StatefulWidget {
  const ParentShell({
    super.key,
    this.initialTab = _packages,
    this.initialChildId,
    this.debugOpenBuy,
    this.debugOpenCard,
  });

  final int initialTab;

  /// Child shown on the dashboard tab when it first opens.
  final String? initialChildId;

  /// Design previews only: start with this dashboard card open (13–16).
  final DashCard? debugOpenCard;

  /// Design previews only: open the Play sheet for this plan on first frame.
  final SubscriptionPlan? debugOpenBuy;

  @override
  State<ParentShell> createState() => _ParentShellState();
}

/// Tab indexes: dashboard first in reading order → right side in RTL.
const int dashboardTab = 0;
const int _packages = 1;

class _ParentShellState extends State<ParentShell> {
  late int _tab = widget.initialTab;
  late String? _dashboardChildId = widget.initialChildId;

  /// Open dashboard card (13–16); back collapses it before leaving the tab.
  late final ValueNotifier<DashCard?> _openCard = ValueNotifier(
    widget.debugOpenCard,
  );

  @override
  void dispose() {
    _openCard.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    final plan = widget.debugOpenBuy;
    if (plan != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) showPlayConfirmSheet(context, plan);
      });
    }
  }

  /// «تجديد الباقة» / «اشترك سنويًا» / «اشترك» → Play sheet; on success the
  /// design continues to «إضافة ابن».
  Future<void> _openBuy(SubscriptionPlan plan) async {
    final bought = await showPlayConfirmSheet(context, plan);
    if (bought && mounted) _openAddChild();
  }

  void _openAddChild() => Navigator.of(context)
      .push(MaterialPageRoute<void>(builder: (_) => const AddChildScreen()));

  void _openAchievements(ChildProfile child) => setState(() {
    _dashboardChildId = child.id;
    _tab = dashboardTab;
  });

  Future<void> _confirmLogout() async {
    final auth = AppScope.of(context).auth;
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('تسجيل الخروج؟'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('إلغاء'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('تسجيل الخروج'),
          ),
        ],
      ),
    );
    // AuthGate returns to the Auth screen on sign-out.
    if (ok == true) await auth.signOut();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _tab == _packages,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        if (_openCard.value != null) {
          _openCard.value = null; // collapse the card → back to frame 12
        } else {
          setState(() => _tab = _packages);
        }
      },
      child: Scaffold(
        body: SafeArea(
          bottom: false,
          child: IndexedStack(
            index: _tab,
            children: [
              DashboardScreen(
                childId: _dashboardChildId,
                openCard: _openCard,
                onSettings: _confirmLogout,
              ),
              PackagesScreen(
                onBuy: _openBuy,
                onAddChild: _openAddChild,
                onAchievements: _openAchievements,
                onSettings: _confirmLogout,
              ),
            ],
          ),
        ),
        bottomNavigationBar: GBottomNav(
          selected: _tab,
          onSelected: (i) => setState(() => _tab = i),
          items: [
            GNavItem(
              label: 'لوحة التحكم',
              icon: (c) => AppIcon.navDashboard(color: c),
            ),
            GNavItem(
              label: 'الباقات',
              icon: (c) => AppIcon.navPackages(color: c),
            ),
          ],
        ),
      ),
    );
  }
}
