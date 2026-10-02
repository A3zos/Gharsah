// The parent's consent for the AI teacher to receive this child's voice (VITE_AI_AGENT=1).
// Off by default. With it on, the recitation recordings go to the AI server (which
// stores them to grade the recitation) and the browser's speech recognition may be
// used; with it off, the child's voice never leaves the device.
// TODO(design): no designed consent card — built from the settings switch.
import { useState } from 'react';

import { setAiVoiceConsent, type ChildProfile } from '../../data/children';
import { agentEnabled } from '../../lesson/server/api';
import { cx } from '../../lib/cx';

export function AiVoiceConsent({ child }: { child: ChildProfile }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<{ id: string; on: boolean } | null>(null);
  if (!agentEnabled()) return null;
  const on = optimistic?.id === child.id ? optimistic.on : child.aiVoiceConsent;
  const labelId = `ai-consent-${child.id}`;

  const toggle = async () => {
    if (busy) return;
    const next = !on;
    if (
      next &&
      !window.confirm(`السماح بإرسال صوت ${child.name} أثناء التسميع إلى خادم المعلّم الذكي وحفظه هناك؟`)
    )
      return;
    setBusy(true);
    setError(null);
    setOptimistic({ id: child.id, on: next });
    try {
      await setAiVoiceConsent(child.id, next);
    } catch (e) {
      setOptimistic(null);
      setError((e as Error).message || 'تعذّر الحفظ — حاول مجددًا.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby={labelId}
      className="flex flex-col gap-[10px] rounded-px-24 border-[1.5px] border-border bg-surface px-[20px] py-[18px]"
    >
      <div className="flex items-center gap-[12px]">
        <span id={labelId} className="grow text-[15.5px] font-extrabold">
          صوت {child.name} للمعلّم الذكي
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={labelId}
          disabled={busy}
          onClick={() => void toggle()}
          className={cx(
            'flex h-[30px] w-[52px] shrink-0 cursor-pointer items-center rounded-px-15 border-0 px-[3px] disabled:opacity-60',
            on ? 'justify-end bg-primary' : 'justify-start bg-border-strong',
          )}
        >
          <span className="h-[24px] w-[24px] rounded-full bg-surface" />
        </button>
      </div>
      <p className="m-0 text-[13px] leading-[1.85] text-text-muted">
        {on
          ? 'مفعّل: يُرسَل صوت طفلك أثناء ترديد الآيات إلى خادم المعلّم الذكي ويُحفظ هناك لتقييم التلاوة، وقد يُستخدم التعرّف على الكلام في المتصفح (يُعالَج لدى Google). يمكنك الإيقاف في أي وقت.'
          : 'متوقف: لا يغادر صوت طفلك جهازه — المعلّم يكتفي بأن طفلك ردّد، ويجيب طفلك بالأزرار أو بالكتابة.'}
      </p>
      {error && (
        <p role="alert" className="m-0 text-[13px] font-bold text-error-text">
          {error}
        </p>
      )}
    </section>
  );
}
