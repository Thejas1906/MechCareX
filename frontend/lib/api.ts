const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err?.detail ?? `API ${path} returned ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err?.detail ?? `API ${path} returned ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  machines: () => get<import('@/types').MachineSummary[]>('/api/machines'),
  machine: (code: string) => get<import('@/types').MachineSummary>(`/api/machines/${code}`),
  machineReadings: (code: string, limit = 100) =>
    get<import('@/types').SensorHistory[]>(`/api/machines/${code}/readings?limit=${limit}`),
  machineHealth: (code: string) => get<unknown>(`/api/machines/${code}/health`),
  machineSpectrum: (code: string) => get<import('@/types').FFTSpectrum>(`/api/machines/${code}/vibration-spectrum`),
  machineFaults: (code: string) => get<unknown[]>(`/api/machines/${code}/faults`),
  alerts: (activeOnly = false) => get<import('@/types').Alert[]>(`/api/alerts${activeOnly ? '?active_only=true' : ''}`),
  alertsForMachine: (code: string) => get<import('@/types').Alert[]>(`/api/alerts?machine_code=${code}`),
  alertCount: () => get<{ active: number; critical: number; warning: number }>('/api/alerts/count'),
  acknowledgeAlert: (id: string) => post<import('@/types').Alert>(`/api/alerts/${id}/acknowledge`),
  analyticsOverview: () => get<import('@/types').FactoryOverview>('/api/analytics/overview'),
  simulationStatus: () => get<{ status: string; running: boolean }>('/api/simulation/status'),

  // AI
  analyzeWithAI: (code: string) => post<import('@/types').AIAnalysis>(`/api/ai/machines/${code}/analyze`),
  latestAI: (code: string) => get<import('@/types').AIAnalysis>(`/api/ai/machines/${code}/latest`),

  // Maintenance
  listMaintenance: (code?: string) => get<import('@/types').MaintenanceRecord[]>(`/api/maintenance${code ? `?machine_code=${code}` : ''}`),
  createMaintenance: (body: {
    machine_code: string; machine_name: string; fault_type?: string;
    issue: string; recommended_action: string; priority: string; notes?: string;
  }) => post<import('@/types').MaintenanceRecord>('/api/maintenance', body),
  updateMaintenance: (id: number, body: { status?: string; notes?: string }) =>
    patch<import('@/types').MaintenanceRecord>(`/api/maintenance/${id}`, body),

  // Reports
  generateReport: (machine_code: string, period: string) =>
    post<import('@/types').ReportData>('/api/reports/generate', { machine_code, period }),
  reportHistory: (code?: string) => get<import('@/types').ReportHistory[]>(`/api/reports/history${code ? `?machine_code=${code}` : ''}`),
  generatePDFUrl: (machine_code: string, period: string) =>
    `${BASE}/api/reports/generate/pdf`,
};

export const WS_URL = (process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000') + '/ws';
export const BASE_URL = BASE;
