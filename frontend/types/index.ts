export type HealthStatus = 'HEALTHY' | 'WARNING' | 'DEGRADED' | 'CRITICAL';

export interface AIInsight {
  summary: string;
  probable_cause: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evidence: string[];
  recommendations: string[];
  urgency: string;
  maintenance_action: string;
}

export interface AIAnalysis {
  machine_code: string;
  machine_name: string;
  fingerprint: string;
  engineering: {
    health_score: number;
    health_status: HealthStatus;
    probable_fault: string;
    overall_severity: string;
    anomaly_count: number;
    anomalies: string[];
    dominant_harmonic: string | null;
  };
  ai: AIInsight;
  generated_at: string;
  cached?: boolean;
}

export interface MaintenanceRecord {
  id: number;
  machine_code: string;
  machine_name: string;
  fault_type: string | null;
  issue: string;
  recommended_action: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
  created_at: string;
  completed_at: string | null;
  notes: string | null;
}

export interface ReportData {
  report_id?: number;
  machine_code: string;
  machine_name: string;
  machine_type: string;
  period: string;
  generated_at: string;
  health: HealthBreakdown;
  sensors: SensorValues;
  baselines: Record<string, number>;
  anomalies: AnomalyResult;
  fft: FFTSpectrum | null;
  readings_count: number;
  fault_events: { fault_type: string; severity: number; started: string; ended: string | null }[];
  ai: AIInsight & { generated_at: string } | null;
  maintenance_records: { issue: string; status: string; priority: string; created_at: string }[];
}

export interface ReportHistory {
  id: number;
  machine_code: string;
  machine_name: string;
  period: string;
  health_score: number;
  has_ai: boolean;
  generated_at: string;
}
export type OperationalStatus = 'RUNNING' | 'WARNING' | 'DEGRADED' | 'CRITICAL' | 'FAULT';
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'NORMAL';
export type AlertStatus = 'ACTIVE' | 'RESOLVED';
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface SensorValues {
  temperature: number;
  vibration: number;
  current: number;
  rpm: number;
  acoustic: number;
}

export interface HealthBreakdown {
  temperature: number;
  vibration: number;
  current: number;
  rpm: number;
  acoustic: number;
  total: number;
  status: HealthStatus;
}

export interface Anomaly {
  type: string;
  severity: AlertSeverity;
  value: number;
  baseline: number;
  deviation_pct: number;
  message: string;
}

export interface AnomalyResult {
  anomalies: Anomaly[];
  probable_fault: string;
  overall_severity: AlertSeverity;
  anomaly_count: number;
}

export interface VibrationSignal {
  components: { '1x': number; '2x': number; '3x': number };
  frequencies: { '1x': number; '2x': number; '3x': number };
  sample_rate: number;
}

export interface TelemetryMessage {
  type: 'sensor_update';
  timestamp: string;
  machine: { id: string; name: string; machine_type?: string };
  sensors: SensorValues;
  active_faults: string[];
  health_score: number;
  health_breakdown: HealthBreakdown;
  status: OperationalStatus;
  anomalies: AnomalyResult;
  vibration_signal?: VibrationSignal;
}

export interface MachineState {
  machine_code: string;
  name: string;
  machine_type: string;
  status: OperationalStatus;
  health_score: number;
  health_breakdown: HealthBreakdown;
  sensors: SensorValues;
  active_faults: string[];
  anomalies: AnomalyResult;
  vibration_signal?: VibrationSignal;
  last_updated: number; // ms timestamp
}

export interface SensorHistory {
  timestamp: number;
  temperature: number;
  vibration: number;
  current: number;
  rpm: number;
  acoustic: number;
  health_score: number;
}

export interface Alert {
  id: string;
  machine_code: string;
  machine_name: string;
  probable_fault: string;
  severity: AlertSeverity;
  anomalies: string[];
  message: string;
  status: AlertStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface FFTSpectrum {
  frequencies: number[];
  amplitudes: number[];
  fundamental_frequency: number;
  harmonics: { '1x': number; '2x': number; '3x': number };
  dominant_frequency: number;
  dominant_harmonic: string;
  components: Record<string, number>;
  sample_rate: number;
  n_samples: number;
}

export interface MachineSummary {
  machine_code: string;
  name: string;
  health_score: number;
  health_status: HealthStatus;
  operational_status: OperationalStatus;
  probable_fault: string;
  anomaly_count: number;
}

export interface FactoryOverview {
  factory: {
    total_machines: number;
    healthy: number;
    warning: number;
    degraded: number;
    critical: number;
    active_alerts: number;
  };
  machines: MachineSummary[];
  fault_distribution: { fault_type: string; count: number }[];
  reading_count: number;
}
