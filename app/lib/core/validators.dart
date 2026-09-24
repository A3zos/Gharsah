abstract final class Validators {
  static final RegExp _email = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$');

  static bool isEmail(String v) => _email.hasMatch(v.trim());
}
