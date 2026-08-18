'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useTelemetry } from '@/hooks/useTelemetry';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { SensorCard } from '@/components/machines/SensorCard';
import { TrendChart } from '@/components/charts/TrendChart';
import { VibrationSpectrum } from '@/components/charts/VibrationSpectrum';
import { HealthBreakdownPanel, HealthScoreRing } from '@/components/health/HealthBreakdown';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AlertCard } from '@/components/alerts/AlertCard';
import { LoadingState, ErrorState } from '@/components/ui/LoadingState';
import { faultLabel } from '@/lib/health';
import { api } from '@/lib/api';
import type { FFTSpectrum, Alert, AIAnalysis, MaintenanceRecord } from '@/types';

const MACHINE_NAMES: Record<string, string> = {
  M01: 'Industrial Motor 01', M02: 'Centrifugal Pump 02', M03: 'Cooling Fan 03',
};

export default function MachineDetailPage() {
  const { machineId } = useParams<{ machineId: string }>();
  const { machines, history, connectionStatus, lastUpdate } = useTelemetry();

  const machine = machines[machineId];
  const machineHistory = history[machineId] ?? [];

  const [spectrum, setSpectrum] = useState<FFTSpectrum | null>(null);
  const [spectrumError, setSpectrumError] = useState(false);
  const [machineAlerts, setMachineAlerts] = useState<Alert[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [showCreateMaint, setShowCreateMaint] = useState(false);
  const [creatingMaint, setCreatingMaint] = useState(false);

  // Fetch FFT on mount and refresh every 5s
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    const fetchSpectrum = async () => {
      try {
        const data = await api.machineSpectrum(machineId);
        setSpectrum(data);
        setSpectrumError(false);
      } catch {
        setSpectrumError(true);
      }
    };
    fetchSpectrum();
    timer = setInterval(fetchSpectrum, 5000);
    return () => clearInterval(timer);
  }, [machineId]);

  // Fetch alerts
  useEffect(() => {
    api.alerts().then(all => setMachineAlerts(all.filter(a => a.machine_code === machineId))).catch(() => {});
    const t = setInterval(() => {
      api.alerts().then(all => setMachineAlerts(all.filter(a => a.machine_code === machineId))).catch(() => {});
    }, 3000);
    return () => clearInterval(t);
  }, [machineId]);

  // Fetch maintenance records
  useEffect(() => {
    api.listMaintenance(machineId).then(setMaintenanceRecords).catch(() => {});
  }, [machineId]);

  // Try to load latest cached AI
  useEffect(() => {
    api.latestAI(machineId).then(setAiAnalysis).catch(() => {});
  }, [machineId]);

  async function runAI() {
    setAiLoading(true); setAiError(null);
    try {
      const result = await api.analyzeWithAI(machineId);
      setAiAnalysis(result);
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setAiLoading(false);
    }
  }

  async function createMaintenanceRecord() {
    if (!machine) return;
    setCreatingMaint(true);
    const fault = machine.anomalies?.probable_fault ?? 'UNKNOWN';
    const aiRec = aiAnalysis?.ai?.maintenance_action ?? 'Inspect machine and refer to engineering diagnostics.';
    try {
      const rec = await api.createMaintenance({
        machine_code: machineId,
        machine_name: MACHINE_NAMES[machineId] ?? machineId,
        fault_type: fault !== 'NORMAL' ? fault : undefined,
        issue: fault !== 'NORMAL' ? `${fault.replace(/_/g, ' ')} detected` : 'Preventive maintenance',
        recommended_action: aiRec,
        priority: machine.anomalies?.overall_severity === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
      });
      setMaintenanceRecords(prev => [rec, ...prev]);
      setShowCreateMaint(false);
    } finally {
      setCreatingMaint(false);
    }
  }

  const activeAlerts = Object.values(machines).filter(m => m.anomalies?.probable_fault !== 'NORMAL').length;

  if (!machine && machineHistory.length === 0) {
    return (
      <div className="app-shell">
        <Sidebar alertCount={activeAlerts} />
        <div className="app-content">
          <Topbar connectionStatus={connectionStatus} lastUpdate={lastUpdate} />
          <div className="page-content">
            <LoadingState message={`Waiting for telemetry from ${machineId}...`} />
          </div>
        </div>
      </div>
    );
  }

  const bd = machine?.health_breakdown;
  const fault = machine?.anomalies?.probable_fault ?? 'NORMAL';

  return (
    <div className="app-shell">
      <Sidebar alertCount={activeAlerts} />
      <div className="app-content">
        <Topbar connectionStatus={connectionStatus} lastUpdate={lastUpdate} />
        <div className="page-content">
          {/* Back nav */}
          <Link href="/machines" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: '#64748b', marginBottom: 16 }}>
            <ArrowLeft size={14} /> Machines
          </Link>

          {/* Machine header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', color: '#FF204E', textTransform: 'uppercase' }}>{machineId}</div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{machine?.name ?? machineId}</h1>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{machine?.machine_type}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <StatusBadge status={machine?.status ?? 'RUNNING'} size="md" />
              {fault !== 'NORMAL' && (
                <div style={{ fontSize: '0.68rem', color: '#f97316', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 4, padding: '2px 8px' }}>
                  ⚠ {faultLabel(fault)}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
            {/* Main column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Sensor Cards */}
              <div>
                <div className="section-title">Live Telemetry</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {(['temperature', 'vibration', 'current', 'rpm', 'acoustic'] as const).map(t => (
                    <SensorCard key={t} type={t} value={machine?.sensors[t] ?? 0} history={machineHistory} />
                  ))}
                </div>
              </div>

              {/* Trend Charts */}
              <div className="card">
                <div className="section-title">Sensor Trends</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginBottom: 4 }}>Temperature (°C)</div>
                    <TrendChart data={machineHistory} dataKey="temperature" label="Temperature" unit="°C" color="#f97316" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginBottom: 4 }}>Vibration (g)</div>
                    <TrendChart data={machineHistory} dataKey="vibration" label="Vibration" unit="g" color="#FF204E" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginBottom: 4 }}>Current (A)</div>
                    <TrendChart data={machineHistory} dataKey="current" label="Current" unit="A" color="#8b5cf6" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginBottom: 4 }}>RPM</div>
                    <TrendChart data={machineHistory} dataKey="rpm" label="RPM" unit="rpm" color="#06b6d4" />
                  </div>
                </div>
              </div>

              {/* Vibration Spectrum */}
              <div className="card">
                <div className="section-title">Vibration Spectrum — FFT Analysis</div>
                {spectrumError ? (
                  <ErrorState message="FFT spectrum unavailable. Simulation must be running." />
                ) : spectrum && spectrum.frequencies.length > 0 ? (
                  <VibrationSpectrum spectrum={spectrum} />
                ) : (
                  <LoadingState message="Computing FFT..." />
                )}
              </div>

              {/* AI Analysis */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div className="section-title" style={{ marginBottom: 0 }}>AI Machine Assessment</div>
                  <button onClick={runAI} disabled={aiLoading}
                    style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: aiLoading ? '#94a3b8' : '#FF204E', color: '#fff', fontSize: '0.72rem', fontWeight: 700, cursor: aiLoading ? 'not-allowed' : 'pointer' }}>
                    {aiLoading ? '⟳ Analyzing...' : '⚡ Analyze with Gemini'}
                  </button>
                </div>
                {aiError && <div style={{ fontSize: '0.72rem', color: '#dc2626', padding: '8px 10px', background: '#fef2f2', borderRadius: 6, marginBottom: 10 }}>{aiError}</div>}
                {aiAnalysis ? (
                  <div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.68rem', padding: '3px 10px', borderRadius: 12, background: '#fef2f2', color: '#dc2626', fontWeight: 700 }}>Risk: {aiAnalysis.ai.risk_level}</span>
                      <span style={{ fontSize: '0.68rem', padding: '3px 10px', borderRadius: 12, background: '#f1f5f9', color: '#475569' }}>{aiAnalysis.ai.urgency}</span>
                      {aiAnalysis.cached && <span style={{ fontSize: '0.6rem', padding: '3px 8px', borderRadius: 12, background: '#f1f5f9', color: '#94a3b8' }}>cached</span>}
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#0f172a', lineHeight: 1.6, margin: '0 0 10px' }}>{aiAnalysis.ai.summary}</p>
                    {aiAnalysis.ai.evidence.slice(0, 3).map((ev, i) => (
                      <div key={i} style={{ fontSize: '0.75rem', color: '#475569', marginBottom: 4 }}>• {ev}</div>
                    ))}
                    {aiAnalysis.ai.maintenance_action && (
                      <div style={{ marginTop: 10, padding: '8px 12px', background: '#fff0f3', border: '1px solid #fecaca', borderRadius: 6, fontSize: '0.75rem', color: '#0f172a' }}>
                        <strong>Action:</strong> {aiAnalysis.ai.maintenance_action}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                    {aiLoading ? 'Sending engineering context to Gemini AI...' : 'Click "Analyze with Gemini" to generate an AI assessment.'}
                  </div>
                )}
              </div>

              {/* Maintenance */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div className="section-title" style={{ marginBottom: 0 }}>Maintenance</div>
                  <button onClick={() => setShowCreateMaint(!showCreateMaint)}
                    style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #00224D', background: 'transparent', color: '#00224D', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>
                    + Create Record
                  </button>
                </div>
                {showCreateMaint && (
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px', marginBottom: 12, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: 10 }}>
                      This will create a maintenance record based on current fault classification
                      {aiAnalysis?.ai?.maintenance_action ? ' and AI recommendation.' : '.'}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={createMaintenanceRecord} disabled={creatingMaint}
                        style={{ flex: 1, padding: '7px', borderRadius: 6, border: 'none', background: '#00224D', color: '#fff', fontSize: '0.72rem', fontWeight: 700, cursor: creatingMaint ? 'not-allowed' : 'pointer' }}>
                        {creatingMaint ? 'Creating...' : 'Create Record'}
                      </button>
                      <button onClick={() => setShowCreateMaint(false)}
                        style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '0.72rem', cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {maintenanceRecords.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>No maintenance records for this machine.</div>
                ) : (
                  maintenanceRecords.slice(0, 3).map(r => (
                    <div key={r.id} style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{r.issue.slice(0, 40)}</span>
                        <span style={{ color: r.status === 'COMPLETED' ? '#16a34a' : r.status === 'IN_PROGRESS' ? '#ca8a04' : '#dc2626', fontWeight: 700, fontSize: '0.65rem' }}>{r.status.replace('_', ' ')}</span>
                      </div>
                      <div style={{ color: '#64748b' }}>{r.recommended_action.slice(0, 60)}…</div>
                    </div>
                  ))
                )}
              </div>

              {/* Event Timeline */}
              {machineAlerts.length > 0 && (
                <div className="card">
                  <div className="section-title">Event Log</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {machineAlerts.slice(0, 10).map(a => <AlertCard key={a.id} alert={a} />)}
                  </div>
                </div>
              )}
            </div>

            {/* Right column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Health score ring */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div className="section-title" style={{ alignSelf: 'flex-start' }}>Health Score</div>
                <HealthScoreRing score={machine?.health_score ?? 100} status={bd?.status ?? 'HEALTHY'} />
                <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center' }}>{bd?.status ?? 'HEALTHY'}</div>
              </div>

              {/* Health breakdown */}
              {bd && (
                <div className="card">
                  <div className="section-title">Health Breakdown</div>
                  <HealthBreakdownPanel breakdown={bd} />
                </div>
              )}

              {/* Anomaly summary */}
              {machine?.anomalies && machine.anomalies.anomaly_count > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#991b1b', marginBottom: 8 }}>Active Anomalies</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {machine.anomalies.anomalies.slice(0, 5).map((a, i) => (
                      <div key={i} style={{ fontSize: '0.7rem', color: '#7f1d1d' }}>• {a.message}</div>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, padding: '6px 10px', background: '#fff5f5', borderRadius: 5, fontSize: '0.7rem', fontWeight: 600, color: '#991b1b' }}>
                    Probable: {faultLabel(machine.anomalies.probable_fault)}
                  </div>
                </div>
              )}

              {/* Vibration harmonics */}
              {machine?.vibration_signal && (
                <div className="card">
                  <div className="section-title">Vibration Harmonics</div>
                  {(['1x', '2x', '3x'] as const).map(h => (
                    <div key={h} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.72rem' }}>
                      <span style={{ color: '#64748b' }}>{h} RPM ({machine.vibration_signal!.frequencies[h].toFixed(1)} Hz)</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{machine.vibration_signal!.components[h].toFixed(4)} g</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
