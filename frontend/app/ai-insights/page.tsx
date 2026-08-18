'use client';
import { useState } from 'react';
import { useTelemetry } from '@/hooks/useTelemetry';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { LoadingState } from '@/components/ui/LoadingState';
import { api } from '@/lib/api';
import { healthColor, faultLabel } from '@/lib/health';
import type { AIAnalysis } from '@/types';

const MACHINES = [
  { code: 'M01', name: 'Industrial Motor 01' },
  { code: 'M02', name: 'Centrifugal Pump 02' },
  { code: 'M03', name: 'Cooling Fan 03' },
];

const RISK_COLORS: Record<string, string> = {
  LOW: '#16a34a', MEDIUM: '#ca8a04', HIGH: '#ea580c', CRITICAL: '#dc2626',
};

const URGENCY_COLORS: Record<string, string> = {
  'Monitor': '#3b82f6',
  'Inspect Soon': '#ca8a04',
  'Schedule Maintenance': '#ea580c',
  'Immediate Attention': '#dc2626',
};

export default function AIInsightsPage() {
  const { machines, connectionStatus, lastUpdate } = useTelemetry();
  const [selectedMachine, setSelectedMachine] = useState('M01');
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeAlerts = Object.values(machines).filter(m => m.anomalies?.probable_fault !== 'NORMAL').length;

  const machineState = machines[selectedMachine];

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.analyzeWithAI(selectedMachine);
      setAnalysis(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar alertCount={activeAlerts} />
      <div className="app-content">
        <Topbar connectionStatus={connectionStatus} lastUpdate={lastUpdate} />
        <div className="page-content" style={{ maxWidth: 860 }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0f172a' }}>AI Machine Intelligence</h1>
            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
              Gemini AI analyses engineering data from Phase 2 to provide diagnostic insights.
            </p>
          </div>

          {/* Machine selector */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Select Machine</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              {MACHINES.map(m => (
                <button key={m.code} onClick={() => { setSelectedMachine(m.code); setAnalysis(null); setError(null); }}
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: 8, border: `2px solid ${selectedMachine === m.code ? '#FF204E' : '#e2e8f0'}`,
                    background: selectedMachine === m.code ? '#fff0f3' : '#f8fafc',
                    cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                  }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: selectedMachine === m.code ? '#FF204E' : '#0f172a' }}>{m.code}</div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 2 }}>{m.name}</div>
                </button>
              ))}
            </div>

            {/* Engineering snapshot */}
            {machineState && (
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Engineering Analysis</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {[
                    { l: 'Health', v: `${machineState.health_score.toFixed(1)}%`, c: healthColor(machineState.health_breakdown?.status ?? 'HEALTHY') },
                    { l: 'Status', v: machineState.health_breakdown?.status ?? '—', c: healthColor(machineState.health_breakdown?.status ?? 'HEALTHY') },
                    { l: 'Fault', v: faultLabel(machineState.anomalies?.probable_fault ?? 'NORMAL'), c: machineState.anomalies?.probable_fault !== 'NORMAL' ? '#dc2626' : '#16a34a' },
                    { l: 'Anomalies', v: String(machineState.anomalies?.anomaly_count ?? 0), c: (machineState.anomalies?.anomaly_count ?? 0) > 0 ? '#ea580c' : '#16a34a' },
                  ].map(s => (
                    <div key={s.l} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.l}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 700, color: s.c, marginTop: 2 }}>{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={runAnalysis} disabled={loading}
              style={{
                width: '100%', padding: '12px', borderRadius: 8, border: 'none',
                background: loading ? '#94a3b8' : '#FF204E', color: '#fff',
                fontWeight: 700, fontSize: '0.85rem', cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}>
              {loading ? '⟳ Analyzing with Gemini AI...' : '⚡ Analyze Machine with Gemini'}
            </button>
            {error && (
              <div style={{ marginTop: 10, padding: '10px 12px', background: '#fef2f2', borderRadius: 6, fontSize: '0.75rem', color: '#dc2626', border: '1px solid #fecaca' }}>
                {error}
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 4 }}>Engineering diagnostics remain available above.</div>
              </div>
            )}
          </div>

          {loading && <LoadingState message="Sending engineering context to Gemini AI..." />}

          {/* AI Result */}
          {analysis && !loading && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div className="section-title" style={{ marginBottom: 0 }}>AI Assessment</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {analysis.cached && (
                    <span style={{ fontSize: '0.6rem', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 10 }}>cached</span>
                  )}
                  <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Generated: {new Date(analysis.generated_at).toLocaleTimeString()}</span>
                </div>
              </div>

              {/* Risk badge */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ padding: '6px 14px', borderRadius: 20, background: RISK_COLORS[analysis.ai.risk_level] + '20', border: `1px solid ${RISK_COLORS[analysis.ai.risk_level]}`, fontSize: '0.75rem', fontWeight: 700, color: RISK_COLORS[analysis.ai.risk_level] }}>
                  Risk: {analysis.ai.risk_level}
                </div>
                <div style={{ padding: '6px 14px', borderRadius: 20, background: (URGENCY_COLORS[analysis.ai.urgency] ?? '#64748b') + '20', border: `1px solid ${URGENCY_COLORS[analysis.ai.urgency] ?? '#64748b'}`, fontSize: '0.75rem', fontWeight: 600, color: URGENCY_COLORS[analysis.ai.urgency] ?? '#64748b' }}>
                  {analysis.ai.urgency}
                </div>
              </div>

              {/* Summary */}
              <div style={{ marginBottom: 16, padding: '12px 14px', background: '#f8fafc', borderRadius: 8, borderLeft: '3px solid #FF204E' }}>
                <div style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Summary</div>
                <p style={{ fontSize: '0.82rem', color: '#0f172a', lineHeight: 1.6, margin: 0 }}>{analysis.ai.summary}</p>
              </div>

              {/* Probable cause */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Probable Cause</div>
                <p style={{ fontSize: '0.82rem', color: '#0f172a', lineHeight: 1.6, margin: 0 }}>{analysis.ai.probable_cause}</p>
              </div>

              {/* Evidence */}
              {analysis.ai.evidence.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Supporting Evidence</div>
                  {analysis.ai.evidence.map((ev, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: '0.8rem', color: '#0f172a', lineHeight: 1.5 }}>
                      <span style={{ color: '#FF204E', flexShrink: 0 }}>•</span>
                      <span>{ev}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Recommendations */}
              {analysis.ai.recommendations.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Recommended Actions</div>
                  {analysis.ai.recommendations.map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                      <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#00224D', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                      <span style={{ fontSize: '0.8rem', color: '#0f172a', lineHeight: 1.5 }}>{r}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Immediate action */}
              {analysis.ai.maintenance_action && (
                <div style={{ padding: '10px 14px', background: '#fff0f3', border: '1px solid #fecaca', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#FF204E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Immediate Action</div>
                  <p style={{ fontSize: '0.8rem', color: '#0f172a', margin: 0, lineHeight: 1.5 }}>{analysis.ai.maintenance_action}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
