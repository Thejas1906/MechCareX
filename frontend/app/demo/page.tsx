'use client';
import { useState, useEffect, useRef } from 'react';
import { useTelemetry } from '@/hooks/useTelemetry';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { healthColor } from '@/lib/health';
import { BASE_URL } from '@/lib/api';

const MACHINES = [
  { code: 'M01', name: 'Industrial Motor 01' },
  { code: 'M02', name: 'Centrifugal Pump 02' },
  { code: 'M03', name: 'Cooling Fan 03' },
];

const SCENARIOS = [
  { key: 'NORMAL', label: 'Normal Operation', description: 'All sensors within baseline', icon: '✓', severity: 0 },
  { key: 'BEARING_FAILURE', label: 'Bearing Failure', description: 'Vibration, temperature, current, acoustic elevated; RPM drops', icon: '⚙', severity: 0.8 },
  { key: 'IMBALANCE', label: 'Imbalance', description: '1× RPM vibration component strongly dominant', icon: '⚖', severity: 0.75 },
  { key: 'MISALIGNMENT', label: 'Misalignment', description: '2× RPM vibration component dominant', icon: '⟷', severity: 0.8 },
  { key: 'OVERLOAD', label: 'Overload', description: 'High current draw, RPM drop, temperature rises', icon: '⚡', severity: 0.9 },
  { key: 'OVERHEATING', label: 'Overheating', description: 'Temperature anomaly only — thermal fault', icon: '🌡', severity: 0.85 },
];

const DEMO_STAGES = ['Initialising', 'Sensor Deviation', 'Anomaly Detection', 'Fault Classification', 'Alert Generated', 'Full Analysis'];

async function injectFault(machine: string, fault: string, severity: number) {
  if (fault === 'NORMAL') {
    await fetch(`${BASE_URL}/api/simulation/machines/${machine}/reset`, { method: 'POST' });
  } else {
    await fetch(`${BASE_URL}/api/simulation/machines/${machine}/fault`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fault_type: fault, severity }),
    });
  }
}

export default function DemoPage() {
  const { machines, connectionStatus, lastUpdate } = useTelemetry();
  const [selectedMachine, setSelectedMachine] = useState('M02');
  const [selectedScenario, setSelectedScenario] = useState(SCENARIOS[1]);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stageTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const DURATION = 30;
  const activeAlerts = Object.values(machines).filter(m => m.anomalies?.probable_fault !== 'NORMAL').length;

  async function startDemo() {
    setRunning(true);
    setStage(0);
    setElapsed(0);

    await injectFault(selectedMachine, selectedScenario.key, selectedScenario.severity);

    timerRef.current = setInterval(() => {
      setElapsed(prev => {
        if (prev >= DURATION) {
          stopDemo();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);

    stageTimerRef.current = setInterval(() => {
      setStage(prev => Math.min(prev + 1, DEMO_STAGES.length - 1));
    }, Math.floor(DURATION * 1000 / DEMO_STAGES.length));
  }

  async function stopDemo() {
    setRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (stageTimerRef.current) clearInterval(stageTimerRef.current);
    await injectFault(selectedMachine, 'NORMAL', 0);
    setStage(0);
    setElapsed(0);
  }

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (stageTimerRef.current) clearInterval(stageTimerRef.current);
  }, []);

  const machineState = machines[selectedMachine];
  const progress = Math.min(100, (elapsed / DURATION) * 100);

  return (
    <div className="app-shell">
      <Sidebar alertCount={activeAlerts} />
      <div className="app-content">
        <Topbar connectionStatus={connectionStatus} lastUpdate={lastUpdate} />
        <div className="page-content" style={{ maxWidth: 860 }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0f172a' }}>Demo Mode</h1>
            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
              Faculty demonstration — inject fault scenarios and observe real-time system response.
            </p>
          </div>

          {!running ? (
            <>
              {/* Machine select */}
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="section-title">Select Machine</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {MACHINES.map(m => {
                    const state = machines[m.code];
                    return (
                      <button key={m.code} onClick={() => setSelectedMachine(m.code)}
                        style={{ flex: 1, padding: '12px 8px', borderRadius: 8, border: `2px solid ${selectedMachine === m.code ? '#FF204E' : '#e2e8f0'}`, background: selectedMachine === m.code ? '#fff0f3' : '#f8fafc', cursor: 'pointer', transition: 'all 0.15s' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: selectedMachine === m.code ? '#FF204E' : '#0f172a' }}>{m.code}</div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 2 }}>{m.name}</div>
                        {state && <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: healthColor(state.health_breakdown?.status ?? 'HEALTHY'), marginTop: 6, fontWeight: 700 }}>{state.health_score.toFixed(1)}%</div>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scenario select */}
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="section-title">Select Fault Scenario</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {SCENARIOS.map(s => (
                    <button key={s.key} onClick={() => setSelectedScenario(s)}
                      style={{ padding: '12px 14px', borderRadius: 8, border: `2px solid ${selectedScenario.key === s.key ? '#00224D' : '#e2e8f0'}`, background: selectedScenario.key === s.key ? '#00224D' : '#f8fafc', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: '1.1rem' }}>{s.icon}</span>
                        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: selectedScenario.key === s.key ? '#fff' : '#0f172a' }}>{s.label}</span>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: selectedScenario.key === s.key ? '#c4cfd8' : '#64748b', lineHeight: 1.4 }}>{s.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Start button */}
              <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 16 }}>
                  Machine <strong>{selectedMachine}</strong> will simulate <strong>{selectedScenario.label}</strong> for 30 seconds, then auto-reset.
                </div>
                <button onClick={startDemo}
                  style={{ padding: '14px 40px', borderRadius: 10, border: 'none', background: '#FF204E', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', letterSpacing: '0.04em' }}>
                  ▶ START DEMO
                </button>
                <div style={{ marginTop: 12, fontSize: '0.68rem', color: '#94a3b8' }}>
                  Switch to the Dashboard to observe real-time sensor changes and alert generation.
                </div>
              </div>
            </>
          ) : (
            /* Demo in progress */
            <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.15em', color: '#FF204E', textTransform: 'uppercase', marginBottom: 12 }}>DEMO IN PROGRESS</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                {selectedMachine} — {selectedScenario.label}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 24 }}>{selectedScenario.description}</div>

              {/* Stage indicator */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Stage: <span style={{ color: '#FF204E' }}>{DEMO_STAGES[stage]}</span>
                </div>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                  {DEMO_STAGES.map((s, i) => (
                    <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= stage ? '#FF204E' : '#e2e8f0', transition: 'background 0.5s' }} />
                  ))}
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#94a3b8', marginBottom: 4 }}>
                  <span>{elapsed}s elapsed</span>
                  <span>{DURATION - elapsed}s remaining</span>
                </div>
                <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: '#FF204E', borderRadius: 4, transition: 'width 1s linear' }} />
                </div>
              </div>

              {/* Live sensor snapshot */}
              {machineState && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 24 }}>
                  {[
                    { l: 'Temp', v: `${machineState.sensors.temperature.toFixed(1)}°C` },
                    { l: 'Vibration', v: `${machineState.sensors.vibration.toFixed(3)}g` },
                    { l: 'Current', v: `${machineState.sensors.current.toFixed(2)}A` },
                    { l: 'RPM', v: machineState.sensors.rpm.toFixed(0) },
                    { l: 'Health', v: `${machineState.health_score.toFixed(1)}%` },
                  ].map(s => (
                    <div key={s.l} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 6px' }}>
                      <div style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.l}</div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', fontSize: '0.9rem', marginTop: 4 }}>{s.v}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginBottom: 16, fontSize: '0.75rem', color: '#64748b' }}>
                Switch to the <strong>Dashboard</strong> or <strong>Machine Detail</strong> page to see the full effect.
              </div>

              <button onClick={stopDemo}
                style={{ padding: '10px 30px', borderRadius: 8, border: '2px solid #dc2626', background: 'transparent', color: '#dc2626', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                ■ STOP DEMO
              </button>
            </div>
          )}

          {/* Faculty demo flow */}
          <div className="card" style={{ marginTop: 20 }}>
            <div className="section-title">Faculty Demonstration Flow (5–7 min)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
              {[
                '1. Open :3000 — show factory overview (3 healthy machines)',
                '2. Open :8000 — demonstrate Virtual Factory UI',
                '3. Demo Mode → Start Bearing Failure on M02',
                '4. Dashboard — watch health score drop, alert appear',
                '5. Machine M02 — show vibration spectrum, 1× harmonic',
                '6. AI Insights → Analyze M02 with Gemini',
                '7. Review AI summary, evidence, recommendations',
                '8. Maintenance → Create maintenance record (OPEN)',
                '9. Advance status: OPEN → IN PROGRESS → COMPLETED',
                '10. Reports → Generate M02 report with AI assessment',
                '11. Export PDF — open and review the document',
                '12. Demo Mode → Stop (reset) — watch health recover',
                '13. Alerts — show resolved alert in history',
                '14. Analytics — show radar chart, health comparison',
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', fontSize: '0.72rem', color: '#475569', borderBottom: '1px solid #f8fafc' }}>
                  <span style={{ color: '#FF204E', fontWeight: 700, flexShrink: 0, width: 20 }}>{i + 1}.</span>
                  <span>{step.replace(/^\d+\.\s/, '')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
