'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { MachineState, TelemetryMessage, SensorHistory, ConnectionStatus } from '@/types';
import { WS_URL } from '@/lib/api';

const HISTORY_MAX = 60;

export interface TelemetryState {
  machines: Record<string, MachineState>;
  history: Record<string, SensorHistory[]>;
  connectionStatus: ConnectionStatus;
  lastUpdate: number | null;
}

export function useTelemetry(): TelemetryState {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const [machines, setMachines] = useState<Record<string, MachineState>>({});
  const [history, setHistory] = useState<Record<string, SensorHistory[]>>({});
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus('connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setConnectionStatus('connected');
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };

    ws.onmessage = (ev: MessageEvent) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(ev.data as string) as TelemetryMessage;
        if (msg.type !== 'sensor_update') return;

        const code = msg.machine.id;
        const now = Date.now();

        const state: MachineState = {
          machine_code: code,
          name: msg.machine.name,
          machine_type: msg.machine.machine_type ?? '',
          status: msg.status,
          health_score: msg.health_score,
          health_breakdown: msg.health_breakdown,
          sensors: msg.sensors,
          active_faults: msg.active_faults,
          anomalies: msg.anomalies,
          vibration_signal: msg.vibration_signal,
          last_updated: now,
        };

        setMachines(prev => ({ ...prev, [code]: state }));
        setLastUpdate(now);

        const point: SensorHistory = {
          timestamp: now,
          temperature: msg.sensors.temperature,
          vibration: msg.sensors.vibration,
          current: msg.sensors.current,
          rpm: msg.sensors.rpm,
          acoustic: msg.sensors.acoustic,
          health_score: msg.health_score,
        };

        setHistory(prev => {
          const existing = prev[code] ?? [];
          const updated = [...existing, point].slice(-HISTORY_MAX);
          return { ...prev, [code]: updated };
        });
      } catch {
        // malformed message — ignore
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnectionStatus('disconnected');
      reconnectTimer.current = setTimeout(connect, 2500);
    };

    ws.onerror = () => {
      setConnectionStatus('error');
      ws.close();
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { machines, history, connectionStatus, lastUpdate };
}
