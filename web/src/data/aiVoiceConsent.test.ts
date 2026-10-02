import { AI_VOICE_CONSENT, childFromRow } from './children';

test('the voice-consent option is off: every lesson runs on-device, even if the column is on', () => {
  expect(AI_VOICE_CONSENT).toBe(false);
  const child = childFromRow({
    id: 'c1',
    name: 'راكان',
    gender: 'boy',
    avatar: 'boy-1',
    ai_voice_consent: true,
  });
  expect(child.aiVoiceConsent).toBe(false);
});
