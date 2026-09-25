// Port of app/test/lesson/presence_detector_test.dart. (The Dart file's last case
// tests its WAV wrapper; the web records the report with MediaRecorder instead,
// so there is no WAV code to test here.)
import { PresenceDetector } from './presenceDetector';

const CHUNK = 50;
let starts: number;
let utterances: number[];
let d: PresenceDetector;

beforeEach(() => {
  starts = 0;
  utterances = [];
  d = new PresenceDetector({ onSpeechStart: () => starts++, onUtterance: (ms) => utterances.push(ms) });
});

function feed(db: number, totalMs: number) {
  for (let t = 0; t < totalMs; t += CHUNK) d.addLevel(db, CHUNK);
}

test('speech then silence = one utterance', () => {
  feed(-65, 1000); // room noise
  feed(-25, 900); // child repeats
  expect(starts).toBe(1);
  expect(utterances).toEqual([]); // still speaking
  feed(-65, 800);
  expect(utterances).toEqual([900]);
});

test('three repeats with pauses = three utterances', () => {
  feed(-65, 1000);
  for (let i = 0; i < 3; i++) {
    feed(-28, 1200);
    feed(-66, 1000);
  }
  expect(utterances).toHaveLength(3);
});

test('short click or cough is ignored', () => {
  feed(-65, 1000);
  feed(-20, 100); // below onset
  feed(-65, 1000);
  feed(-20, 250); // above onset, below min
  feed(-65, 1000);
  expect(utterances).toEqual([]);
});

test('a short breath inside a sentence does not split it', () => {
  feed(-65, 1000);
  feed(-25, 600);
  feed(-65, 400); // < hangover
  feed(-25, 600);
  feed(-65, 1000);
  expect(utterances).toHaveLength(1);
});

test('adapts to a noisy room (steady fan is not speech)', () => {
  feed(-40, 6000); // loud steady noise
  expect(utterances).toEqual([]);
  feed(-18, 800); // speech above the noise
  feed(-40, 1000);
  expect(utterances).toHaveLength(1);
});

test('PCM input: a tone is voiced, zeros are silence; level 0..1', () => {
  const pcm = (amp: number, ms: number) => {
    const n = 16 * ms;
    const b = new DataView(new ArrayBuffer(n * 2));
    for (let i = 0; i < n; i++) {
      b.setInt16(i * 2, Math.round(amp * 32767 * Math.sin((2 * Math.PI * 220 * i) / 16000)), true);
    }
    return new Uint8Array(b.buffer);
  };
  for (let i = 0; i < 20; i++) d.addPcm16(pcm(0.0005, 50));
  for (let i = 0; i < 16; i++) d.addPcm16(pcm(0.3, 50));
  expect(d.level).toBeGreaterThan(0.5);
  for (let i = 0; i < 20; i++) d.addPcm16(pcm(0, 50));
  expect(d.level).toBe(0);
  expect(utterances).toHaveLength(1);
});
