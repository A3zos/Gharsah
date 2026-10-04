import { AI_VOICE_CONSENT, childFromRow } from './children';

const row = (ai_voice_consent?: boolean | null) =>
  childFromRow({ id: 'c1', name: 'راكان', gender: 'boy', avatar: 'boy-1', ai_voice_consent });

test('the parent’s voice consent (the add / edit child box) reaches the lesson', () => {
  expect(AI_VOICE_CONSENT).toBe(true);
  expect(row(true).aiVoiceConsent).toBe(true);
});

test('off unless the parent checked the box', () => {
  expect(row(false).aiVoiceConsent).toBe(false);
  expect(row(null).aiVoiceConsent).toBe(false);
  expect(row().aiVoiceConsent).toBe(false);
});
