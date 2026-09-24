# app/ — تطبيق غَرْسة (Flutter)

Flutter app (Android-first + web). All Flutter and Firebase CLI commands run **from this folder**.

```bash
cd app
flutter pub get
flutter run -d chrome          # quick check
flutter run -d emulator-5554   # Android emulator
flutter analyze
```

- Firebase config: `firebase.json`, `firestore.rules` (deploy: `firebase deploy --only firestore:rules --project nibras-59284`).
- Rules tests: `tool/rules_test/` (Firestore emulator).
- Design comparison tooling: `tool/design_compare/` — design PNGs live in `../design/screens/`.
- Verified Quran text: `assets/data/splash_ayat.json` (Tanzil, CC BY 3.0) — never edit by hand.
