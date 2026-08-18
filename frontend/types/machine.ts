export type MachineStatus = 'RUNNING' | 'WARNING' | 'CRITICAL' | 'FAULT';

export type FaultType =
  | 'NORMAL'
  | 'BEARING_FAILURE'
  | 'IMBALANCE'
  | 'MISALIGNMENT'
  | 'OVERLOAD'
  | 'OVERHEATING'
  | 'RPM_ANOMALY'
  | 'ACOUSTIC_ANOMALY';

export interface Machine {
  id: number;
  machine_code: string;
  name: string;
  machine_type: string;
  description?: string;
  location?: string;
  status: MachineStatus;
  health_score: number;
  created_at: string;
  updated_at: string;
}

export interface SensorReading {
  id: number;
  machine_id: number;
  timestamp: string;
  temperature: number;
  vibration: number;
  current: number;
  rpm: number;
  acoustic: number;
  vibration_signal?: {
    components: { '1x': number; '2x': number; '3x': number };
    frequencies: { '1x': number; '2x': number; '3x': number };
    sample_rate: number;
  };
}

export interface WsSensorUpdate {
  type: 'sensor_update';
  timestamp: string;
  machine: { id: string; name: string };
  sensors: {
    temperature: number;
    vibration: number;
    current: number;
    rpm: number;
    acoustic: number;
  };
  active_faults: string[];
  health_score: number;
  status: MachineStatus;
  vibration_signal?: SensorReading['vibration_signal'];
}
