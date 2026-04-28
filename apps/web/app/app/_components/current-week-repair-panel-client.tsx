'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type ScenarioPreview = {
  scenario: 'missed_session' | 'fatigued' | 'fresher' | 'reduce_load' | 'increase_specificity';
  actionLabel: string;
  title: string;
  summary: string;
  impactSummary: string;
  protectedKeyDay: string;
  changes: Array<{
    date: string;
    changeType: 'reshaped' | 'sharpened' | 'load_adjusted';
    before: string;
    after: string;
    beforeIntervalLabel?: string;
    afterIntervalLabel?: string;
    beforeFamilyIntent?: string;
    afterFamilyIntent?: string;
    rationaleTags?: string[];
    reason: string;
  }>;
};

export function CurrentWeekRepairPanelClient({
  draftId,
  initialPreviews,
}: {
  draftId: string;
  initialPreviews: ScenarioPreview[];
}) {
  const router = useRouter();
  const [previews, setPreviews] = useState<ScenarioPreview[]>(initialPreviews);
  const [busyScenario, setBusyScenario] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ title: string; detail: string } | null>(null);

  async function refreshPreview(scenario: ScenarioPreview['scenario']) {
    setBusyScenario(scenario);
    setNotice(null);
    try {
      const response = await fetch('/api/planner/month/replan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId, scenario, intent: 'preview' }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.previewScenario) {
        setNotice({ title: 'Preview failed', detail: payload?.error || 'Could not refresh this repair preview.' });
        return;
      }
      setPreviews((current) => current.map((item) => item.scenario === scenario ? payload.previewScenario as ScenarioPreview : item));
      setNotice({ title: 'Preview refreshed', detail: `${payload.previewScenario.title} updated from the latest live week.` });
    } finally {
      setBusyScenario(null);
    }
  }

  async function applyScenario(scenario: ScenarioPreview['scenario']) {
    setBusyScenario(scenario);
    setNotice(null);
    try {
      const response = await fetch('/api/planner/month/replan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId, scenario, intent: 'apply' }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setNotice({ title: 'Repair failed', detail: payload?.error || 'Could not apply this current-week repair.' });
        return;
      }
      setNotice({ title: 'Repair applied', detail: 'Current-week draft bridge updated from the selected preview.' });
      router.refresh();
    } finally {
      setBusyScenario(null);
    }
  }

  return (
    <div className="training-plan-current-week-panel__scenario-list">
      <div className="kicker">Preview exact week changes</div>
      {notice ? (
        <div className="status-item" style={{ marginBottom: 10 }}>
          <strong>{notice.title}</strong>
          <p>{notice.detail}</p>
        </div>
      ) : null}
      {previews.map((preview) => {
        const busy = busyScenario === preview.scenario;
        return (
          <div key={preview.scenario} className="training-plan-current-week-panel__scenario-card status-item">
            <strong>{preview.title}</strong>
            <p>{preview.summary}</p>
            <span>{preview.impactSummary}</span>
            <span>Protected key day: {preview.protectedKeyDay}</span>
            {preview.changes.map((change) => (
              <div key={`${preview.scenario}-${change.date}-${change.after}`} className="training-plan-current-week-panel__change-row">
                <strong>{change.date}</strong>
                <p>{change.before}</p>
                {change.beforeIntervalLabel ? <span>Before structure: {change.beforeIntervalLabel}</span> : null}
                {change.beforeFamilyIntent ? <span>Before intent: {change.beforeFamilyIntent}</span> : null}
                <p>→ {change.after}</p>
                {change.afterIntervalLabel ? <span>After structure: {change.afterIntervalLabel}</span> : null}
                {change.afterFamilyIntent ? <span>After intent: {change.afterFamilyIntent}</span> : null}
                {change.rationaleTags?.length ? <span>Why this family: {change.rationaleTags.join(' • ')}</span> : null}
                <span>{change.reason}</span>
              </div>
            ))}
            <div className="button-row" style={{ marginTop: 10 }}>
              <button type="button" className="button-secondary" onClick={() => refreshPreview(preview.scenario)} disabled={busy}>Refresh preview</button>
              <button type="button" className="button-secondary button-link" onClick={() => applyScenario(preview.scenario)} disabled={busy}>{preview.actionLabel}</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
