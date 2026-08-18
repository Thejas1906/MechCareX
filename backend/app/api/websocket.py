import json
import logging
from datetime import datetime
from fastapi import WebSocket, WebSocketDisconnect

from app.services.health_service import compute_health
from app.services.anomaly_service import detect_anomalies
from app.services.alert_service import get_alert_service

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self._connections: set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._connections.add(ws)
        logger.info(f"WebSocket connected. Total: {len(self._connections)}")

    def disconnect(self, ws: WebSocket):
        self._connections.discard(ws)
        logger.info(f"WebSocket disconnected. Total: {len(self._connections)}")

    async def broadcast(self, message: dict):
        dead = set()
        payload = json.dumps(message)
        for ws in self._connections:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._connections.discard(ws)

    @property
    def connection_count(self) -> int:
        return len(self._connections)


manager = ConnectionManager()


async def ws_broadcast_callback(machines: dict, now: datetime):
    alert_svc = get_alert_service()

    for code, state in machines.items():
        # Compute health breakdown
        breakdown = compute_health(
            code, state.temperature, state.vibration,
            state.current, state.rpm, state.acoustic
        )

        # Update engine's health_score with computed value
        # Do NOT overwrite status when machine is manually set OFFLINE (under maintenance)
        state.health_score = breakdown.total
        if state.status != "OFFLINE":
            if breakdown.total >= 90:
                state.status = "RUNNING"
            elif breakdown.total >= 70:
                state.status = "WARNING"
            elif breakdown.total >= 40:
                state.status = "DEGRADED"
            else:
                state.status = "CRITICAL"

        # Anomaly detection
        anomaly_result = detect_anomalies(
            code, state.temperature, state.vibration,
            state.current, state.rpm, state.acoustic,
            state.vibration_signal.get("components") if state.vibration_signal else None,
        )

        # Alert management
        alert_svc.process(code, state.name, anomaly_result)

        message = {
            "type": "sensor_update",
            "timestamp": now.isoformat(),
            "machine": {
                "id": state.machine_code,
                "name": state.name,
                "machine_type": state.baseline.machine_type,
            },
            "sensors": {
                "temperature": round(state.temperature, 2),
                "vibration": round(state.vibration, 4),
                "current": round(state.current, 3),
                "rpm": round(state.rpm, 1),
                "acoustic": round(state.acoustic, 1),
            },
            "active_faults": state.active_fault_names(),
            "health_score": round(breakdown.total, 1),
            "health_breakdown": breakdown.to_dict(),
            "status": state.status,
            "anomalies": anomaly_result.to_dict(),
            "vibration_signal": state.vibration_signal,
        }
        await manager.broadcast(message)
