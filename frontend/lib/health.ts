import type { HealthBreakdown, HealthStatus } from '@/types';

const BASELINES: Record<string, { temp: number; vib: number; curr: number; rpm: number; acou: number }> = {
  M01: { temp: 45, vib: 0.20, curr: 1.75, rpm: 1450, acou: 46 },
  M02: { temp: 50, vib: 0.28, curr: 2.50, rpm: 1750, acou: 50 },
  M03: { temp: 40, vib: 0.15, curr: 1.05, rpm: 1200, acou: 45 },
};

const clamp = (v: number) => Math.max(0, Math.min(100, v));

export function computeHealthBreakdown(
  machineCode: string,
  temp: number, vib: number, curr: number, rpm: number, acou: number
): HealthBreakdown {
  const cfg = BASELINES[machineCode] ?? BASELINES.M01;

  const t = clamp(100 - Math.max(0, temp - (cfg.temp + 3)) / 30 * 100);
  const v = clamp(100 - Math.max(0, vib / cfg.vib - 1.15) / 5 * 100);
  const c = clamp(100 - Math.max(0, curr / cfg.curr - 1.1) / 1.2 * 100);
  const r = clamp(100 - Math.max(0, Math.abs(rpm - cfg.rpm) / cfg.rpm - 0.03) / 0.2 * 100);
  const a = clamp(100 - Math.max(0, acou - (cfg.acou + 4)) / 20 * 100);

  const total = clamp(0.20 * t + 0.30 * v + 0.20 * c + 0.15 * r + 0.15 * a);

  return { temperature: t, vibration: v, current: c, rpm: r, acoustic: a, total, status: healthStatus(total) };
}

export function healthStatus(score: number): HealthStatus {
  if (score >= 90) return 'HEALTHY';
  if (score >= 70) return 'WARNING';
  if (score >= 40) return 'DEGRADED';
  return 'CRITICAL';
}

export function healthColor(status: HealthStatus | string): string {
  switch (status) {
    case 'HEALTHY': return '#22c55e';
    case 'WARNING': return '#f59e0b';
    case 'DEGRADED': return '#f97316';
    case 'CRITICAL': return '#ef4444';
    default: return '#8a9ab5';
  }
}

export function severityColor(s: string): string {
  if (s === 'CRITICAL') return '#ef4444';
  if (s === 'WARNING') return '#f59e0b';
  if (s === 'INFO') return '#60a5fa';
  return '#22c55e';
}

export function faultLabel(fault: string): string {
  const labels: Record<string, string> = {
    NORMAL: 'Normal',
    BEARING_FAILURE: 'Bearing Failure',
    BEARING_DEGRADATION: 'Bearing Degradation',
    IMBALANCE: 'Mechanical Imbalance',
    MISALIGNMENT: 'Shaft Misalignment',
    OVERLOAD: 'Overload',
    OVERHEATING: 'Overheating',
    RPM_ANOMALY: 'RPM Anomaly',
    ACOUSTIC_ANOMALY: 'Acoustic Anomaly',
    UNKNOWN_ANOMALY: 'Unknown Anomaly',
  };
  return labels[fault] ?? fault;
}
