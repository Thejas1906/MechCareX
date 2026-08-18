"""
Alert management with DB persistence for MechCareX Phase 3.
In-memory state for real-time speed; DB for persistence across restarts.
"""
import asyncio
import uuid
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from collections import deque

logger = logging.getLogger(__name__)

FAULT_MESSAGES = {
    "BEARING_DEGRADATION": "Possible bearing degradation — vibration, temperature, and current all elevated",
    "IMBALANCE": "Possible mechanical imbalance — strong 1× RPM vibration component dominant",
    "MISALIGNMENT": "Possible shaft misalignment — 2× RPM vibration component dominant",
    "OVERLOAD": "Machine overload detected — high current draw with RPM drop and temperature rise",
    "OVERHEATING": "Overheating condition — temperature significantly above baseline",
    "RPM_ANOMALY": "RPM anomaly — operating speed deviated from nominal",
    "ACOUSTIC_ANOMALY": "Elevated acoustic emission — possible bearing or structural noise",
    "UNKNOWN_ANOMALY": "Multiple sensor anomalies detected — investigation recommended",
}


@dataclass
class Alert:
    id: str
    machine_code: str
    machine_name: str
    probable_fault: str
    severity: str          # INFO, WARNING, CRITICAL
    anomalies: list[str]
    message: str
    status: str            # ACTIVE, ACKNOWLEDGED, RESOLVED
    created_at: datetime
    resolved_at: Optional[datetime] = None
    acknowledged_at: Optional[datetime] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "machine_code": self.machine_code,
            "machine_name": self.machine_name,
            "probable_fault": self.probable_fault,
            "severity": self.severity,
            "anomalies": self.anomalies,
            "message": self.message,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "acknowledged_at": self.acknowledged_at.isoformat() if self.acknowledged_at else None,
        }


class AlertService:
    def __init__(self):
        self._alerts: dict[str, Alert] = {}
        self._active_by_machine: dict[str, str] = {}  # machine_code → alert_id
        self._history: deque[Alert] = deque(maxlen=200)

    def process(self, machine_code: str, machine_name: str, anomaly_result) -> Optional[Alert]:
        """Called every tick. Creates, updates, or resolves alerts based on current anomaly state."""
        if not anomaly_result.anomalies or anomaly_result.probable_fault == "NORMAL":
            self._maybe_resolve(machine_code)
            return None

        existing_id = self._active_by_machine.get(machine_code)
        if existing_id and existing_id in self._alerts:
            existing = self._alerts[existing_id]
            # If fault type changed, resolve old and create new
            if existing.probable_fault != anomaly_result.probable_fault:
                self._resolve(existing_id)
                return self._create(machine_code, machine_name, anomaly_result)
            # Update severity if escalated
            if anomaly_result.overall_severity == "CRITICAL" and existing.severity != "CRITICAL":
                existing.severity = "CRITICAL"
            return existing

        return self._create(machine_code, machine_name, anomaly_result)

    def _create(self, machine_code: str, machine_name: str, anomaly_result) -> Alert:
        alert_id = str(uuid.uuid4())[:8]
        message = FAULT_MESSAGES.get(anomaly_result.probable_fault,
                                     f"Anomaly detected: {anomaly_result.probable_fault}")
        alert = Alert(
            id=alert_id,
            machine_code=machine_code,
            machine_name=machine_name,
            probable_fault=anomaly_result.probable_fault,
            severity=anomaly_result.overall_severity,
            anomalies=[a.type for a in anomaly_result.anomalies],
            message=message,
            status="ACTIVE",
            created_at=datetime.utcnow(),
        )
        self._alerts[alert_id] = alert
        self._active_by_machine[machine_code] = alert_id
        logger.info(f"Alert created: [{alert.severity}] {machine_code} → {alert.probable_fault}")
        asyncio.create_task(self._db_create(alert))
        return alert

    def _maybe_resolve(self, machine_code: str):
        existing_id = self._active_by_machine.get(machine_code)
        if existing_id:
            self._resolve(existing_id)
            del self._active_by_machine[machine_code]

    def _resolve(self, alert_id: str):
        alert = self._alerts.get(alert_id)
        if alert and alert.status == "ACTIVE":
            alert.status = "RESOLVED"
            alert.resolved_at = datetime.utcnow()
            self._history.append(alert)
            logger.info(f"Alert resolved: {alert.machine_code} → {alert.probable_fault}")
            asyncio.create_task(self._db_update(alert))

    async def _db_create(self, alert: "Alert"):
        try:
            from app.db.session import AsyncSessionLocal
            from app.models.machine import PersistentAlert
            async with AsyncSessionLocal() as db:
                rec = PersistentAlert(
                    id=alert.id,
                    machine_code=alert.machine_code,
                    machine_name=alert.machine_name,
                    probable_fault=alert.probable_fault,
                    severity=alert.severity,
                    anomalies=alert.anomalies,
                    message=alert.message,
                    status="ACTIVE",
                    created_at=alert.created_at,
                )
                db.add(rec)
                await db.commit()
        except Exception as e:
            logger.warning(f"Failed to persist alert to DB: {e}")

    async def _db_update(self, alert: "Alert"):
        try:
            from app.db.session import AsyncSessionLocal
            from app.models.machine import PersistentAlert
            from sqlalchemy import select
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(PersistentAlert).where(PersistentAlert.id == alert.id))
                rec = result.scalar_one_or_none()
                if rec:
                    rec.status = alert.status
                    rec.resolved_at = alert.resolved_at
                    rec.acknowledged_at = alert.acknowledged_at if hasattr(alert, "acknowledged_at") else None
                    await db.commit()
        except Exception as e:
            logger.warning(f"Failed to update alert in DB: {e}")

    async def load_from_db(self):
        """
        Load recent alerts from DB on startup for historical viewing.
        Does NOT track them as active machine conditions — the simulation
        starts fresh and will create new alerts if faults persist.
        """
        try:
            from app.db.session import AsyncSessionLocal
            from app.models.machine import PersistentAlert
            from sqlalchemy import select, desc
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(PersistentAlert)
                    .order_by(desc(PersistentAlert.created_at))
                    .limit(100)
                )
                count = 0
                for rec in result.scalars().all():
                    alert = Alert(
                        id=rec.id,
                        machine_code=rec.machine_code,
                        machine_name=rec.machine_name,
                        probable_fault=rec.probable_fault,
                        severity=rec.severity,
                        anomalies=rec.anomalies or [],
                        message=rec.message,
                        status=rec.status,
                        created_at=rec.created_at,
                        resolved_at=rec.resolved_at,
                        acknowledged_at=rec.acknowledged_at,
                    )
                    self._alerts[rec.id] = alert
                    count += 1
                logger.info(f"Loaded {count} historical alerts from DB")
        except Exception as e:
            logger.warning(f"Could not load alerts from DB: {e}")

    def acknowledge(self, alert_id: str) -> Optional["Alert"]:
        alert = self._alerts.get(alert_id)
        if alert and alert.status == "ACTIVE":
            alert.status = "ACKNOWLEDGED"
            alert.acknowledged_at = datetime.utcnow()
            asyncio.create_task(self._db_update(alert))
        return alert

    def get_active(self) -> list[Alert]:
        return [a for a in self._alerts.values() if a.status == "ACTIVE"]

    def get_all(self, limit: int = 50) -> list[Alert]:
        all_alerts = list(self._alerts.values())
        all_alerts.sort(key=lambda a: a.created_at, reverse=True)
        return all_alerts[:limit]

    def get_for_machine(self, machine_code: str) -> list[Alert]:
        return [a for a in self._alerts.values() if a.machine_code == machine_code]


# Singleton
_alert_service: Optional[AlertService] = None


def get_alert_service() -> AlertService:
    global _alert_service
    if _alert_service is None:
        _alert_service = AlertService()
    return _alert_service
