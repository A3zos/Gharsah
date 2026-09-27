// revoke-pairing-code: the PARENT kills the child's current code, unpairs every
// device of that child, and gets a fresh code («إصدار رمز جديد»).
// Replaces the Firebase callable revokePairingCode.
import { pairingHandler } from '../_shared/http.ts';

Deno.serve(pairingHandler(true));
