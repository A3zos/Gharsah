/// The signed-in parent, as the UI sees it. Keeps FirebaseAuth types out of widgets.
class AppUser {
  const AppUser({
    required this.uid,
    required this.email,
    required this.displayName,
    required this.emailVerified,
  });

  final String uid;
  final String? email;
  final String? displayName;
  final bool emailVerified;
}
