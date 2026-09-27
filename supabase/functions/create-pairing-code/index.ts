// create-pairing-code: a signed-in PARENT asks for a 6-digit code (10 min,
// single-use) for one of their children; returns the still-valid one if any.
// Requires an active plan. Replaces the Firebase callable createPairingCode.
import { pairingHandler } from '../_shared/http.ts';

Deno.serve(pairingHandler(false));
