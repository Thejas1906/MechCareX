'use client';
import { useState, useEffect } from 'react';
import { useTelemetry } from '@/hooks/useTelemetry';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { LoadingState } from '@/components/ui/LoadingState';
import { healthColor, faultLabel } from '@/lib/health';
import { api, BASE_URL } from '@/lib/api';
import type { ReportData, ReportHistory } from '@/types';

const MACHINES = [
  { code: 'M01', name: 'Industrial Motor 01' },
  { code: 'M02', name: 'Centrifugal Pump 02' },
  { code: 'M03', name: 'Cooling Fan 03' },
];
const PERIODS = [
  { value: '1h', label: 'Last Hour' },
  { value: '6h', label: 'Last 6 Hours' },
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
];

export default function ReportsPage() {
  const { machines, connectionStatus, lastUpdate } = useTelemetry();
  const [selectedMachine, setSelectedMachine] = useState('M01');
  const [period, setPeriod] = useState('24h');
  const [report, setReport] = useState<ReportData | null>(null);
  const [history, setHistory] = useState<ReportHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeAlerts = Object.values(machines).filter(m => m.anomalies?.probable_fault !== 'NORMAL').length;

  useEffect(() => {
    api.reportHistory().then(setHistory).catch(() => {});
  }, []);

  async function generate() {
    setLoading(true); setError(null);
    try {
      const data = await api.generateReport(selectedMachine, period);
      setReport(data);
      api.reportHistory().then(setHistory).catch(() => {});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Report generation failed');
    } finally {
      setLoading(false);
    }
  }

  async function downloadPDF() {
    setPdfLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/reports/generate/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machine_code: selectedMachine, period }),
      });
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mechcarex_${selectedMachine}_${period}_report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'PDF download failed');
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar alertCount={activeAlerts} />
      <div className="app-content">
        <Topbar connectionStatus={connectionStatus} lastUpdate={lastUpdate} />
        <div className="page-content">
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0f172a' }}>Reports</h1>
            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>Generate machine health reports with sensor data, anomaly analysis, and AI assessment.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
            {/* Controls */}
            <div>
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="section-title">Generate Report</div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Machine</div>
                  {MACHINES.map(m => (
                    <button key={m.code} onClick={() => setSelectedMachine(m.code)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', marginBottom: 4, borderRadius: 6, border: `1px solid ${selectedMachine === m.code ? '#FF204E' : '#e2e8f0'}`, background: selectedMachine === m.code ? '#fff0f3' : '#f8fafc', cursor: 'pointer', fontSize: '0.8rem', color: selectedMachine === m.code ? '#FF204E' : '#0f172a', fontWeight: selectedMachine === m.code ? 700 : 400 }}>
                      {m.code} — {m.name}
                    </button>
                  ))}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Period</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {PERIODS.map(p => (
                      <button key={p.value} onClick={() => setPeriod(p.value)}
                        style={{ padding: '7px 6px', borderRadius: 6, border: `1px solid ${period === p.value ? '#00224D' : '#e2e8f0'}`, background: period === p.value ? '#00224D' : '#f8fafc', color: period === p.value ? '#fff' : '#475569', fontSize: '0.72rem', fontWeight: period === p.value ? 700 : 400, cursor: 'pointer' }}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                {error && <div style={{ fontSize: '0.72rem', color: '#dc2626', padding: '8px 10px', background: '#fef2f2', borderRadius: 6, marginBottom: 10 }}>{error}</div>}
                <button onClick={generate} disabled={loading}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: loading ? '#94a3b8' : '#00224D', color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: loading ? 'not-allowed' : 'pointer', marginBottom: 8 }}>
                  {loading ? '⟳ Generating...' : '⚙ Generate Report'}
                </button>
                {report && (
                  <button onClick={downloadPDF} disabled={pdfLoading}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, border: '2px solid #FF204E', background: 'transparent', color: '#FF204E', fontWeight: 700, fontSize: '0.82rem', cursor: pdfLoading ? 'not-allowed' : 'pointer' }}>
                    {pdfLoading ? '⟳ Generating PDF...' : '⬇ Export PDF'}
                  </button>
                )}
              </div>

              {/* Report history */}
              {history.length > 0 && (
                <div className="card">
                  <div className="section-title">Report History</div>
                  {history.slice(0, 8).map(h => (
                    <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.72rem' }}>
                      <div>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#FF204E' }}>{h.machine_code}</span>
                        <span style={{ color: '#64748b', marginLeft: 6 }}>{h.period}</span>
                        {h.has_ai && <span style={{ marginLeft: 6, fontSize: '0.6rem', background: '#f0fdf4', color: '#16a34a', padding: '1px 5px', borderRadius: 8 }}>AI</span>}
                      </div>
                      <div style={{ color: '#94a3b8' }}>{new Date(h.generated_at).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Report preview */}
            {loading ? <LoadingState message="Compiling report data..." /> : report ? (
              <ReportPreview report={report} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, background: '#f8fafc', borderRadius: 12, border: '2px dashed #e2e8f0' }}>
                <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>⚙</div>
                  <div style={{ fontSize: '0.8rem' }}>Select a machine and period, then generate a report</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportPreview({ report }: { report: ReportData }) {
  const health = report.health;
  const anomalies = report.anomalies;

  return (
    <div>
      {/* Header */}
      <div className="card" style={{ marginBottom: 16, borderTop: '4px solid #FF204E' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#FF204E', letterSpacing: '0.15em', marginBottom: 4 }}>MechCareX — Machine Health Report</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{report.machine_code} — {report.machine_name}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>{report.machine_type} · Period: {report.period} · {new Date(report.generated_at).toLocaleString()}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '2rem', fontFamily: 'monospace', fontWeight: 700, color: healthColor(health.status) }}>{round1(health.total)}%</div>
            <div style={{ fontSize: '0.72rem', color: healthColor(health.status), fontWeight: 700 }}>{health.status}</div>
          </div>
        </div>
      </div>

      {/* Sensor summary */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">Sensor Summary</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Parameter', 'Current', 'Baseline', 'Sub-Score', 'Deviation'].map(h => (
                <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: '0.65rem', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { name: 'Temperature', sk: 'temperature' as const, bk: 'temp', unit: '°C' },
              { name: 'Vibration', sk: 'vibration' as const, bk: 'vib', unit: 'g' },
              { name: 'Current', sk: 'current' as const, bk: 'curr', unit: 'A' },
              { name: 'RPM', sk: 'rpm' as const, bk: 'rpm', unit: '' },
              { name: 'Acoustic', sk: 'acoustic' as const, bk: 'acou', unit: 'dB' },
            ].map(row => {
              const curr = report.sensors[row.sk];
              const bl = report.baselines[row.bk] ?? 0;
              const sub = health[row.sk as keyof typeof health] as number ?? 100;
              const dev = bl ? ((curr - bl) / bl * 100).toFixed(1) : '0.0';
              const devNum = parseFloat(dev);
              return (
                <tr key={row.name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '7px 10px', fontWeight: 600, color: '#475569' }}>{row.name}</td>
                  <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: '#0f172a' }}>{typeof curr === 'number' ? curr.toFixed(2) : '—'}{row.unit}</td>
                  <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: '#94a3b8' }}>{bl}{row.unit}</td>
                  <td style={{ padding: '7px 10px', color: sub < 70 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>{round1(sub)}%</td>
                  <td style={{ padding: '7px 10px', color: devNum > 10 ? '#ea580c' : devNum < -5 ? '#3b82f6' : '#64748b' }}>{devNum >= 0 ? '+' : ''}{dev}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Anomalies */}
      {anomalies.anomalies.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title">Detected Anomalies</div>
          <div style={{ marginBottom: 8, fontSize: '0.78rem', color: '#0f172a' }}>
            Probable Fault: <strong>{faultLabel(anomalies.probable_fault)}</strong> · Severity: <strong style={{ color: anomalies.overall_severity === 'CRITICAL' ? '#dc2626' : '#ca8a04' }}>{anomalies.overall_severity}</strong>
          </div>
          {anomalies.anomalies.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 8px', background: '#fef2f2', borderRadius: 6, marginBottom: 6, fontSize: '0.75rem' }}>
              <span style={{ color: '#dc2626', fontWeight: 700 }}>{a.type.replace(/_/g, ' ')}</span>
              <span style={{ color: '#64748b' }}>{a.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* FFT */}
      {report.fft && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title">Vibration Analysis (FFT)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, fontSize: '0.75rem' }}>
            {[
              { l: '1× (Fund.)', v: `${report.fft.fundamental_frequency.toFixed(1)} Hz` },
              { l: '2× RPM', v: `${report.fft.harmonics['2x'].toFixed(1)} Hz` },
              { l: '3× RPM', v: `${report.fft.harmonics['3x'].toFixed(1)} Hz` },
              { l: 'Dominant', v: report.fft.dominant_harmonic },
            ].map(s => (
              <div key={s.l} style={{ background: '#f8fafc', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.l}</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">AI Assessment</div>
        {report.ai ? (
          <div>
            <div style={{ fontSize: '0.8rem', color: '#0f172a', lineHeight: 1.6, marginBottom: 10 }}>{report.ai.summary}</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[{ l: 'Risk', v: report.ai.risk_level }, { l: 'Urgency', v: report.ai.urgency }].map(s => (
                <span key={s.l} style={{ fontSize: '0.7rem', padding: '3px 10px', borderRadius: 12, background: '#f1f5f9', color: '#475569' }}>
                  <strong>{s.l}:</strong> {s.v}
                </span>
              ))}
            </div>
            {(report.ai.recommendations ?? []).slice(0, 3).map((r, i) => (
              <div key={i} style={{ fontSize: '0.78rem', color: '#475569', marginBottom: 4 }}>
                {i + 1}. {r}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>
            AI analysis was not requested for this report. Visit the AI Insights page to generate one.
          </div>
        )}
      </div>
    </div>
  );
}

function round1(n: number): string {
  return n.toFixed(1);
}
