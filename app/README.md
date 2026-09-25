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
- Verified content lives in `../content/` (shared with web/); `assets/{data,lessons,audio/quran}` is a
  committed mirror — edit `../content/` and run `dart run tool/sync_content.dart`, never edit by hand.
